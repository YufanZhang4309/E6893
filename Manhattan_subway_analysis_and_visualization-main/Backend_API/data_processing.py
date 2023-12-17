from pyspark.sql import SparkSession, Window
from pyspark.sql.functions import lag, col, sum, trim, to_date, date_format, desc, when, rank
import json


def load_data(file_path):

    spark = SparkSession.builder.appName("turnstile-analysis").getOrCreate()

    data_df = spark.read.format("csv") \
        .option("header", "true") \
        .load(file_path)

    return data_df


def process_data(turnstile_file_path, station_file_path):

    turnstile_df = load_data(turnstile_file_path)

    # Eliminate the spaces
    turnstile_df = turnstile_df.withColumnRenamed(
        "EXITS                                                               ", "EXITS")
    turnstile_df = turnstile_df.withColumn("EXITS", trim(turnstile_df["EXITS"])) \
        .withColumn("date", date_format(to_date("date", "MM/dd/yyyy"), "MM-dd-yyyy"))
    # turnstile_df = turnstile_df.filter(col("DESC") == "REGULAR")

    stations_df = load_data(station_file_path)

    # Filter the station in Manhattan
    manhattan_stations_df = stations_df.filter(stations_df.borough == "Manhattan")

    # Join
    combined_df = turnstile_df.join(manhattan_stations_df.alias("manhattan_stations"), [
        turnstile_df.STATION == manhattan_stations_df.station,
        turnstile_df.LINENAME == manhattan_stations_df.line_names,
        turnstile_df.DIVISION == manhattan_stations_df.division
    ])

    # Replace the "time"
    replaced_time_df = combined_df.withColumn("time", when(col("time") == "01:00:00", "00:00:00")
                                              .when(col("time") == "05:00:00", "04:00:00")
                                              .when(col("time") == "09:00:00", "08:00:00")
                                              .when(col("time") == "13:00:00", "12:00:00")
                                              .when(col("time") == "17:00:00", "16:00:00")
                                              .when(col("time") == "21:00:00", "20:00:00")
                                              .otherwise(col("time")))

    # Filer out the unwanted rows
    selected_time_df = replaced_time_df.filter(
        col("time").isin(["00:00:00", "04:00:00", "08:00:00", "12:00:00", "16:00:00", "20:00:00"]))



    # Calculate the number of entrances and exits for each station at each date and time
    window_spec = Window.partitionBy("manhattan_stations.station", "linename", "manhattan_stations.division", "C/A", "UNIT", "scp")\
        .orderBy("date", "time")
    selected_df = selected_time_df \
        .select(
            col("manhattan_stations.station").alias("station"),
            col("linename"),
            col("manhattan_stations.division").alias("division"),
            col("manhattan_stations.Lat").cast("float").alias("latitude"),
            col("manhattan_stations.Long").cast("float").alias("longitude"),
            col("C/A"),
            col("UNIT"),
            col("scp"),
            col("date"),
            col("time"),
            col("ENTRIES").cast("int"),
            col("EXITS").cast("int"),
            (col("ENTRIES") - lag("ENTRIES", 1).over(window_spec)).cast("int").alias("enter_num"),
            (col("EXITS") - lag("EXITS", 1).over(window_spec)).cast("int").alias("exit_num")
        )\
        .na.drop()  # drop the first line

    # Add a column for the total number of people
    selected_df = selected_df.withColumn("total_num", col("enter_num") + col("exit_num"))

    aggregated_df = selected_df.groupBy("station", "linename", "division", "date", "time", "latitude", "longitude")\
        .agg(
            sum("enter_num").cast("int").alias("enter"),
            sum("exit_num").cast("int").alias("exit"),
            sum("total_num").cast("int").alias("total")
        ) \
        .orderBy(desc("total"))

    # Filter out incorrect data
    # "INWOOD-207 ST": 05:00:01
    # "BOWERY": missing 03/29/2023,12:00:00
    # "96 ST" "linename:6" missing 03-29-2023,16:00:00
    filtered_df = aggregated_df.filter(~col("station").isin("57 ST", "96 ST-2 AVE", "190 ST", "DELANCEY/ESSEX", "51 ST", "125 ST", "INWOOD-207 ST", "BOWERY"))
    filtered_df = filtered_df.filter((col("station") != "96 ST") | (col("linename") != "6"))

    # test_df = filtered_df.filter(
    #     (col("date") == "03-28-2023") &
    #     (col("time") == "08:00:00")
    # )
    # test_df.show()

    # Get the number of stations
    # count_df = aggregated_df.groupBy("station", "linename", "division").count()
    # num_rows = count_df.count()
    # print("the number of stations: ", num_rows)
    #
    # print("orderBy(count, ascending=False).show()")
    # aggregated_df.groupBy("station", "linename", "division").count().orderBy("count", ascending=False).show()

    # Write data to a JSON file with a Key ID
    results = {}
    for row in filtered_df.collect():
        key = f"{row['station']}_{row['linename']}_{row['division']}"
        row_obj = {
            key: {
                "station": row["station"],
                "center": {
                    "lat": row["latitude"],
                    "lng": row["longitude"]
                },
                "linename": row["linename"],
                "division": row["division"],
                "enter": row["enter"],
                "exit": row["exit"],
                "total": row["total"],
                "date": row["date"],
                "time": row["time"]
            }
        }
        if key in results:
            results[key].append(row_obj)
        else:
            results[key] = [row_obj]

    with open("data.json", "w") as f:
        json.dump(results, f)

    '''
     Find out the top 10 stations with the highest number of people on each date and time
    '''
    window_spec = Window.partitionBy("date", "time").orderBy(desc("total"))

    ranked_df = filtered_df \
        .withColumn("rank", rank().over(window_spec)) \
        .filter(col("rank") <= 10)\
        .orderBy("rank")

    # test_df2 = ranked_df.filter(
    #     (col("date") == "03-31-2023") &
    #     (col("time") == "12:00:00")
    # )
    # test_df2.show()

    top10 = {}
    for row in ranked_df.collect():
        key = f"{row['station']}_{row['linename']}_{row['division']}"
        row_obj = {
            key: {
                "station": row["station"],
                "center": {
                    "lat": row["latitude"],
                    "lng": row["longitude"]
                },
                "linename": row["linename"],
                "division": row["division"],
                "enter": row["enter"],
                "exit": row["exit"],
                "total": row["total"],
                "date": row["date"],
                "time": row["time"],
                "rank": row["rank"]
            }
        }
        if key in top10:
            top10[key].append(row_obj)
        else:
            top10[key] = [row_obj]

    with open("top10_stations.json", "w") as f:
        json.dump(top10, f)

    '''
        count the total number of people in all stations on each date
    '''
    total_by_date = filtered_df.groupBy("date").agg(sum("total").alias("total_by_date")).orderBy("date")
    # total_by_date.show()
    # total_by_date.write.format("csv").option("header", "true").mode("overwrite").save("total_by_date.csv")


    '''
        count the total number of people in all stations on each date and time
    '''
    total_by_datetime = filtered_df.groupBy("date", "time").agg(sum("total").alias("total_by_date_time")).orderBy("date", "time")
    # total_by_datetime.show()
    # total_by_datetime.write.format("csv").option("header", "true").mode("overwrite").save("total_by_datetime.csv")
