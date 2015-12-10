//Array tridimensionale che conterrà il numero del poligono,
//Latitudine, Longitudine.
var coordinates = [];
// orari delle varie ztl
var schedule = [];

//Variazione della conversioe delle coordinate
const xDev = 0.000602675772;
const yDev = -0.000388919537;

/**
 * intit() inizializza la pagina, creando la mappa di google
 */
function init(){
  var mapDiv = document.getElementById("mymap");
  //Opzioni della mappa
  var mapOptions = {
      center: new google.maps.LatLng (45.06395112586439, 7.679700392784639),
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.HYBRID
  };
  var map = new google.maps.Map(mapDiv, mapOptions);

  var points = [];

  // Opzioni di poligono
  var polygonOptions = [];
  var polygon = [];
  var color = [];

  var currentDate = new Date();
  var currentTime = currentDate.getHours() * 60 + currentDate.getMinutes();

  // Se la ZTL è chiusa, si colora di rosso
  for(var i = 0; i < schedule.length; i++) {
    var s = schedule[i][0].split(":")[0] * 60 + schedule[i][0].split(":")[1];
    var e = schedule[i][1].split(":")[0] * 60 + schedule[i][1].split(":")[1];
    if(currentTime > s && currentTime < e) {
      color[i] = "red";
    }
    else{
      color[i] = "green";
    }
  }

  var polyColors = [];
  var c = 0;
  for(i = 0; i < schedule.length; i++) {
    for(var j = 0; j < schedule[i][2]; j++) {
      polyColors[c] = color[i];
      c++;
    }
  }

  for(i = 0; i < coordinates.length; i++) {
    points[i] = getPoints(coordinates[i]);
    polygonOptions[i] = {
                           path: points[i],
                           fillColor:polyColors[i],
                           strokeOpacity:0.5
                         };
    polygon[i] = new google.maps.Polygon(polygonOptions[i]);

    polygon[i].setMap(map);
  }
}
//window.onload = init;

//Costanti usati per la conversione da Gauss Boaga in WGS84
const conv_rate = 111092.08210;
const a1 = 0.1449300705;
const a2 = 0.0002138508;
const a3 = 0.0000004322;
const x0 = 1500000 //2520000 con fuse = 2
const lambda = 9 //15 con fuse = 2
const rad = Math.PI / 180;

/**
 * coordinateConversion() prende 2 coordinate di sistema Gauss Boaga Fuso Ovest,
 *                e li converte in Latitudine e Longitudine.
 * @param {number} x - Coordinata east
 * @param {number} y - Coordinata north
 * @return {number} Lat - Latitudine in gradi
 * @return {number} Lon - Longitudine in gradi
 */
function coordinateConversion(x, y) {

  x -= x0;

  var N = y / conv_rate;
  var Nr = N * rad;

  var A = N + a1 * Math.sin(2 * Nr) + a2 *Math.sin(4 * Nr)+ a3 * Math.sin(6 * Nr);
  A *= rad;

  var v = Math.sqrt(1 + 0.0067681702 * Math.pow(Math.cos(A), 2));

  var B = Math.atan( (v * Math.sinh(x / 6397376.633) ) / Math.cos(A) );

  var Lat = (Math.atan(Math.tan(A) * Math.cos(v * B))) / rad;
  var Lon = B/rad + lambda;

  return[Lat, Lon];
}

//Apertura file XML
var xhttp = new XMLHttpRequest();
xhttp.onreadystatechange = function() {
    if (xhttp.readyState === 4 && xhttp.status === 200) {
      loadData(xhttp);
    }
};
xhttp.open("GET", "convertcsv.xml", false);
xhttp.send();

/*
 * loadData() estrae i dati dal documento XML, li passa ad altre funzioni
 *    per ellaborarli e convertirli, infine li carica in una array tridimensionale
 * @param {XMLHttpRequest} xml - un documento XML
 */
function loadData(xml) {
    var xmlDoc = xml.responseXML;
    var rows = xmlDoc.getElementsByTagName('ROW'); //Dati ROW

    var string = ["", "", ""]; //Stringa con i dati su un WKT_GEOM

    for(i = 0; i < rows.length; i++) {
        schedule[i] = new Array(3);

        var row = rows[i];
        var polygon = row.getElementsByTagName("WKT_GEOM");
        var sTime = row.getElementsByTagName("ORA_INIZIO");
        var eTime = row.getElementsByTagName("ORA_FINE");
        //Trasformazione dell'object htmlcolection in stringa
        for(var j= 0; j < polygon[0].childNodes.length; j++) {
          string[i] += polygon[0].childNodes[j].nodeValue;
        }
        schedule[i][0] = sTime[0].childNodes[0].nodeValue;
        schedule[i][1] = eTime[0].childNodes[0].nodeValue;
    }

    // Split di ogni poligono
    var split = [];
    for(i = 0; i < string.length; i++) {
        split[i] = new Array(string[i].length);
        split[i] = splitString(string[i]);
    }

    // Cancellazione degli elementi che non contengono un sottopoligono
    for(i = 0; i < split.length; i++){
        for(j = 0; j < split[i].length; j++) {
            if(split[i][j] === "POLYGON " || split[i][j] === "," || split[i][j] === ")") {
               split[i].splice(j, 1);
            }
        }
    }

    var cont = 0;
    // Caricamento delle coordinate in array
    for(i = 0; i < split.length; i++) {
        schedule[i][2] = split[i].length;
        for(var k = 0; k < split[i].length; k++) {
            //Per ogni poligono si effettua l'estrazione delle coordinate
            var polygonPoints = wktParser(split[i][k]);
            coordinates[cont] = new Array(polygonPoints.length / 2);
            j = 0;
            for(var r = 0; r < (polygonPoints.length / 2); r++) {
                coordinates[cont][r] = new Array(2);
                coordinates[cont][r][0] = coordinateConversion(polygonPoints[j], polygonPoints[j+1])[0] + xDev;
                coordinates[cont][r][1] = coordinateConversion(polygonPoints[j], polygonPoints[j+1])[1] + yDev;
                j += 2;
            }
            cont ++;
        }
    }
  }

/*
* splitString() divide un wkt in più poligoni
* @param {string} polygon - stringa poligono/multipoligono da dividere
* @return {string} string - array di stringhe contenenti i poligoni
*/
function splitString(polygon) {
   var string = polygon.split(/\(([^)]+)\)/);
   return string;
}

/*
* wktParser() estrae le coordinate dei punti dal poligono
* @param {string} polygon - stringa poligono/multipoligono
* @return {string} string - array di string contenenti le coordinate
*/
function wktParser(polygon) {
 var string = polygon.match(/(\d*\.)?\d+/g);
 return string;
}

/*
* getPoints() trasforma le coordinate in punti sulla mappa
* @param {number} coordinates - matrice contenente le coordinate di un poligono
* @return {MVCArray} points - array dei punti sulla mappa
*/
function getPoints(coordinates) {
 var points = new google.maps.MVCArray();
 for(i = 0; i < coordinates.length; i++) {
    points.push (new google.maps.LatLng(coordinates[i][0], coordinates[i][1]));
 }
 return points;
}
