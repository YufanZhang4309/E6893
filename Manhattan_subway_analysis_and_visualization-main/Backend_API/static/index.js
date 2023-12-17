const jsonBox = document.querySelector('.json-box');
const button1 = document.getElementById('03-25-2023/05:00:00');
const button2 = document.getElementById('03-26-2023/04:00:00');
const button3 = document.getElementById('03-28-2023/08:00:00');
const button4 = document.getElementById('03-25-2023/04:00:00');


button1.addEventListener('click', function() {
    const date = '03-25-2023';
    const time = '05:00:00';
    const url = `/data/${date}/${time}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log(data);
            jsonBox.textContent = JSON.stringify(data, null, 2);
            })
        .catch(error => console.error(error));
});


button2.addEventListener('click', function() {
    const date = '03-26-2023';
    const time = '04:00:00';
    const url = `/data/${date}/${time}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log(data);
            jsonBox.textContent = JSON.stringify(data, null, 2);
            })
        .catch(error => console.error(error));
});


button3.addEventListener('click', function() {
    const date = '03-28-2023';
    const time = '08:00:00';
    const url = `/data/${date}/${time}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            jsonBox.textContent = JSON.stringify(data, null, 2);
            })
        .catch(error => console.error(error));
});

button4.addEventListener('click', function() {
    const date = '03-25-2023';
    const time = '04:00:00';
    const url = `/top10/${date}/${time}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            jsonBox.textContent = JSON.stringify(data, null, 2);
            })
        .catch(error => console.error(error));
});
