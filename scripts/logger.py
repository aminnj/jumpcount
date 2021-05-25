from flask import Flask, redirect, url_for, request
import json
app = Flask(__name__)

@app.after_request
def add_headers(response):
    response.headers.add('Content-Type', 'application/json')
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Expose-Headers', 'Content-Type,Content-Length,Authorization,X-Pagination')
    return response

@app.route('/logger',methods = ['POST'])
def main():
    data = request.get_json()
    nlines = 0
    with open("out.jsonl", "a") as fh:
        for d in data["results_buffer"]:
            dnew = {}
            dnew["timestamp"] = d["timestamp"]
            dnew["landmarks"] = []
            for lm in d.get("landmarks",[]):
                dnew["landmarks"].append(dict(
                    x=round(lm["x"],5),
                    y=round(lm["y"],5),
                    z=round(lm["z"],5),
                    vis=round(lm["visibility"],3),
                    ))
            fh.write(json.dumps(dnew) + "\n")
            nlines += 1
    print(f"Wrote {nlines} lines")
    return "success"

if __name__ == '__main__':
    app.run(debug = True)
