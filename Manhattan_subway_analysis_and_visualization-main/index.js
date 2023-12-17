"use strict";
const date = ["03-25-2023", "03-26-2023", "03-27-2023", "03-28-2023", "03-29-2023", "03-30-2023", "03-31-2023"]
const time = ["00:00:00", "04:00:00", "08:00:00", "12:00:00", "16:00:00", "20:00:00"]
const size = 30;
// object used to store all circle object
var allCircle = {};

async function initMap(stataionData) {
  //Request needed libraries.
  //@ts-ignore
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerView } = await google.maps.importLibrary("marker");
  // Create the map.
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12.7,
    center: { lat: 40.75, lng: -73.95 },
    mapTypeId: "roadmap",
  });
  // add transitLayer
  const transitLayer = new google.maps.TransitLayer();
  transitLayer.setMap(map);
  // Construct the circle for each value in citymap.
  // Note: We scale the area of the circle based on the population.
  for (let stationID in stataionData) {
    // Add the circle for this station to the map.
    allCircle[stationID] = {
      'enter': new google.maps.Circle({
        strokeColor: "blue",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "blue",
        fillOpacity: 0.05,
        map,
        center: stataionData[stationID]["center"],
        radius: (stataionData[stationID]['enter'] > 0) ? Math.log(stataionData[stationID]['enter']) * size : 0
        }), 
      "exit" : new google.maps.Circle({
        strokeColor: "red",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "red",
        fillOpacity: 0.05,
        map,
        center: stataionData[stationID]["center"],
        radius: (stataionData[stationID]['exit'] > 0) ? Math.log(stataionData[stationID]['exit']) * size : 0
        })
    };
  }
};

get_throughput("03-25-2023", "04:00:00").then(
  function(value) { 
  initMap(value);
}
);

get_top10("03-25-2023", "04:00:00").then(
  function(value) { 
  createTable(value); 
}
);

const streamButton = document.getElementById('streamButton');
const timeLineSlider = document.getElementById('timeLineSlider');
const timelineText = document.getElementById('timelineText');

const sleep = (time) => {
  return new Promise((resolve) => setTimeout(resolve, time))
}

async function get_throughput(date, time) {
  const url = `http://127.0.0.1:5000/data/${date}/${time}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}

async function get_top10(date, time) {
  const url = `http://127.0.0.1:5000/top10/${date}/${time}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}

function updateCircle(stataionData) {
  for (let stationID in stataionData) {
    if(allCircle[stationID] !== undefined){
      let processedEnter = 0;
      let processedExit = 0;
      if( stataionData[stationID]['enter'] > 0 ) {
        processedEnter = Math.log(stataionData[stationID]['enter']) * size
      }
      if( stataionData[stationID]['exit'] > 0 ) {
        processedExit = Math.log(stataionData[stationID]['exit']) * size
      }
      allCircle[stationID]['enter'].setRadius(processedEnter);
      allCircle[stationID]['exit'].setRadius(processedExit);
    } else {
      console.log("Station ID Not found: ", stationID)
    }
  };
}

function appendRow(table, rank, stationName, enter, exit) {
  let row = table.insertRow(-1);
  let rnk = row.insertCell(0);
  let station = row.insertCell(1);
  let throughput = row.insertCell(2);
  let enterNum = row.insertCell(3);
  let exitNum = row.insertCell(4);
  rnk.innerHTML = `${rank}`;
  station.innerHTML = `${stationName}`;
  throughput.innerHTML = `${enter + exit}`;
  enterNum.innerHTML = `${enter}`;
  exitNum.innerHTML = `${exit}`;
}

function sortTable() {
  var table, rows, switching, i, x, y, shouldSwitch;
  table = document.getElementById("ranking_table");
  switching = true;
  while (switching) {
    switching = false;
    rows = table.rows;
    for (i = 1; i < (rows.length - 1); i++) {
      shouldSwitch = false;
      x = rows[i].getElementsByTagName("TD")[0];
      y = rows[i + 1].getElementsByTagName("TD")[0];
      if (Number(x.innerHTML) > Number(y.innerHTML)) {
        //if so, mark as a switch and break the loop:
        shouldSwitch = true;
        break;
      }
    }
    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
    }
  }
}

function createTable(top10) {
  const table = document.getElementById('ranking_table');
  for (let i = 0; i < 10; i++) {
    let currentStation = Object.values(top10)[i];
    appendRow(table, currentStation["rank"], currentStation["station"], currentStation["enter"], currentStation["exit"]);
  }
  sortTable()
}

function updateTable(top10) {
  const table = document.getElementById('ranking_table');
  for (let i = 0; i < 10; i++) {
    let currentStation = Object.values(top10)[i];
    appendRow(table, currentStation["rank"], currentStation["station"], currentStation["enter"], currentStation["exit"]);
    table.deleteRow(1);
  }
  sortTable()
}

streamButton.addEventListener('click', async function stream() {
  const initialText = 'Start Streaming';
  const stopText = "Stop Streaming";
  if (streamButton.textContent === initialText) {
    streamButton.textContent = stopText;
    while (streamButton.textContent === stopText) {
      let dateSelected = date[Math.floor(timeLineSlider.value / 6)];
      let timeSelected = time[timeLineSlider.value % 6];
      get_throughput(dateSelected, timeSelected).then(
        function(value) {
          updateCircle(value);}
      );
      get_top10(dateSelected, timeSelected).then(
        function(value) { 
          updateTable(value);
      }
      );
      if (dateSelected === "03-31-2023" && timeSelected === "20:00:00") {
        streamButton.textContent = initialText;
        break
      }
      await sleep(100);
      timeLineSlider.stepUp(1);
      timelineText.innerHTML = `Time: ${dateSelected} ${timeSelected}`;
    }
  } else {
    streamButton.textContent = initialText;
  }
});

timeLineSlider.addEventListener('input',async function handleSlide() {
  let dateSelected = date[Math.floor(timeLineSlider.value / 6)];
  let timeSelected = time[timeLineSlider.value % 6];
  get_throughput(dateSelected, timeSelected).then(
    function(value) {
      updateCircle(value);}
  );
  get_top10(dateSelected, timeSelected).then(
    function(value) { 
      updateTable(value);
  }
  );
  timelineText.innerHTML = `Time: ${dateSelected} ${timeSelected}`;
}, false);



// Pie chart
google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(drawPieChart);

// Draw the chart and set the chart values
function drawPieChart() {
  var data = google.visualization.arrayToDataTable([
  ['Day of the Week', 'Throughput'],
  ['Sunday', 1466995],
  ['Mondy', 2391266],
  ['Tuesday', 2640607],
  ['Wednesday', 2732913],
  ['Thursday', 2721853],
  ['Friday', 2559018],
  ['Saturday', 1369484],
]);

  // Optional; add a title and set the width and height of the chart
  var options = {
    title:'Daily Throughput for Each Day of the Week',
    backgroundColor: { fill:'transparent' },
    is3D: true,
  };

  // Display the chart inside the <div> element with id="piechart"
  var chart = new google.visualization.PieChart(document.getElementById('piechart'));
  chart.draw(data, options);
}

// Curve line
google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(drawLineChart);

function drawLineChart() {
  var data = google.visualization.arrayToDataTable([
    ['Time', 'Entry', 'Exit', 'Total'],
    ['00:00:00',  492810,  759979,  1252789],
    ['04:00:00',  90638,   180329,  270967],
    ['08:00:00',  548907,  1452896, 2001803],
    ['12:00:00',  969122,  2851702, 3820824],
    ['16:00:00',  1551468, 2406150, 3957618],
    ['20:00:00',  1888756, 2689379, 4578135]
  ]);

  var options = {
    title: 'Throughput at Different Times',
    curveType: 'function',
    legend: { position: 'bottom' },
    backgroundColor: { fill:'transparent' },
    hAxis: {
      title: 'Time',
    },
    vAxis: {
      title: 'Throughput'
    }
  };

  var chart = new google.visualization.LineChart(document.getElementById('curve_chart'));

  chart.draw(data, options);
}