Array.prototype.sum = function() {
    return this.reduce(function(a,b){return a+b;}, 0);
};
Array.prototype.mean = function() {
    return this.sum()/this.length;
};
Array.prototype.std = function() {
    const n = this.length;
    const mean = this.mean();
    return Math.sqrt(this.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
};

function CircularArray(maxLength) {
  this.maxLength = maxLength;
}
CircularArray.prototype = Object.create(Array.prototype);
CircularArray.prototype.push = function(element) {
  Array.prototype.push.call(this, element);
  while (this.length > this.maxLength) {
    this.shift();
  }
}
CircularArray.prototype.mean = function(element) {
  return this.reduce((a, b) => a + b, 0)/this.length;
}
CircularArray.prototype.diff = function(element) {
    return this.slice(1).map((n,i) => n-this[i]);
}


class Detector {
    constructor(lag, threshold) {
        this.y = Array(lag+1).fill(0);
        this.lag = lag;
        this.threshold = threshold;
        this.signals = Array(this.y.length).fill(0);
        this.filteredY = [...this.y];
        this.avgFilter = Array(this.y.length).fill(0);
        this.stdFilter = Array(this.y.length).fill(0);
        this.avgFilter[this.lag - 1] = this.y.slice(0,this.lag).mean();
        this.stdFilter[this.lag - 1] = this.y.slice(0,this.lag).std();
    }

    update(newval) {
        this.y.push(newval);
        let i = this.y.length - 1;

        this.signals.push(0);
        this.filteredY.push(0);
        this.avgFilter.push(0);
        this.stdFilter.push(0);


        let dy = Math.abs(this.y[i] - this.avgFilter[i - 1]);
        let tlow = this.threshold * this.stdFilter[i - 1];
        if ((dy > tlow)) {
            if (this.y[i] > this.avgFilter[i - 1]) {
                this.signals[i] = 1;
            } else {
                this.signals[i] = -1;
            }

            this.filteredY[i] = this.filteredY[i - 1];
        } else {
            this.signals[i] = 0;
            this.filteredY[i] = this.y[i];
        }

        this.avgFilter[i] = this.filteredY.slice(i-this.lag,i).mean()
        this.stdFilter[i] = this.filteredY.slice(i-this.lag,i).std()

        return this.signals[i]
    }
}




const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

var results_buffer = [];
var url = "http://localhost:5000/logger"

Plotly.plot('chart',[{
    y:[],
    type:'line',
},{
    y:[],
    type:'line',
},{
    y:[],
    type:'line',
}],
    {
        yaxis: {
            range: [-0.4,0.4],
        }
    }
);
var npoints = 0;

var rollings = {
    11: new CircularArray(30),
    12: new CircularArray(30),
    23: new CircularArray(30),
    24: new CircularArray(30),
}
var detector = new Detector(30, 1.0);

var prevsig = 0;
var njump = 0;
var jumptimes = new CircularArray(10);

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                 {color: '#00FF00', lineWidth: 4});
  drawLandmarks(canvasCtx, results.poseLandmarks,
                {color: '#FF0000', lineWidth: 2});
  canvasCtx.restore();


    var landmarks = results["poseLandmarks"];
    var ts = Date.now();

    if (landmarks.length > 0) {
        [11,12,23,24].forEach(
            i => rollings[i].push(landmarks[i].y)
        );
        // console.log(
        //     rollings[11].mean(),
        //     rollings[12].mean(),
        //     rollings[23].mean(),
        //     rollings[24].mean(),
        // );

        let yval = (
            (landmarks[11].y - rollings[11].mean()) +
            (landmarks[12].y - rollings[12].mean()) +
            (landmarks[23].y - rollings[23].mean()) +
            (landmarks[24].y - rollings[24].mean()));

        let meanvis = (
            landmarks[11].visibility +
            landmarks[12].visibility +
            landmarks[23].visibility +
            landmarks[24].visibility
        )/4;

        let sig = 0;
        if (meanvis >= 0.75) {
            sig = 0.3*detector.update(yval);
        }
        // console.log(sumvis);

        let jump = ((prevsig > 0) && (sig < 0));
        prevsig = sig;

        if (jump) {
            njump++;
            jumptimes.push(0.001*ts);
            console.log(jumptimes, jumptimes.diff(), jumptimes.diff().mean());
            let rate = Math.round(60./jumptimes.diff().mean());
            document.getElementById("jumpcount").innerHTML = `${njump} jumps at ${rate}/min`;
        }

        Plotly.extendTraces("chart",{ y: [[yval],[sig],[0.4*meanvis]]}, [0,1,2]);
        npoints++;
        if (npoints>150) {
            Plotly.relayout('chart',{
                xaxis: {
                    range: [npoints-150,npoints]
                }
            });
        }

    }


  // var ret = {};
  // ret["landmarks"] = results["poseLandmarks"];
  // ret["timestamp"] = Date.now();
    // results_buffer.push(ret);
    // if (results_buffer.length >= 100) {
    //     $.ajax({
    //         type: 'POST',
    //         url: url,
    //         data: JSON.stringify({"results_buffer": results_buffer}),
    //         contentType: 'application/json',
    //     });
    //     results_buffer = [];
    // }

}

            

const pose = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
pose.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({image: videoElement});
  },
  width: 640,
  height: 360
});
camera.start();
