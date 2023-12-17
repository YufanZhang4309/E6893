from flask import Flask, jsonify, render_template
from data_processing import process_data
import json

app = Flask(__name__)
# app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB


@app.route("/")
def index():
    print("This is root")
    return render_template("index.html")


@app.route("/data", methods=["GET"])
def get_data():
    with open("data.json", "r") as f:
        results = json.load(f)
    return jsonify(results)


@app.route("/data/<date>/<time>", methods=["GET"])
def get_data_by_datetime(date, time):
    print("get_data_by_datetime")
    print(date)
    print(time)
    with open("data.json", "r") as f:
        data = json.load(f)
    filtered_data = {}
    for key, value in data.items():
        for row in value:
            if row[key]["date"] == date and row[key]["time"] == time:
                filtered_data[key] = row[key]
    print("len(filtered_data)", len(filtered_data))
    response = jsonify(filtered_data)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route("/top10/<date>/<time>", methods=["GET"])
def get_top10_by_datetime(date, time):
    print("get_top10_by_datetime")
    print(date)
    print(time)
    with open("top10_stations.json", "r") as f:
        data = json.load(f)
    filtered_data = {}
    for key, value in data.items():
        for row in value:
            if row[key]["date"] == date and row[key]["time"] == time:
                filtered_data[key] = row[key]
    print("len(filtered_data)", len(filtered_data))
    response = jsonify(filtered_data)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


if __name__ == "__main__":
    turnstile_file = "data/turnstile_230401.txt"

    station_file = "data/NYSubway.csv"
    process_data(turnstile_file, station_file)
    app.run()
