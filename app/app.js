console.log('Node version = ' + process.version);
var express = require('express');
var path = require('path');
var bodyParser = require("body-parser");

var app = express();

app.set('view engine', 'ejs')

app.set('port', process.env.PORT || 3000);

//app.use(express.static("public"));
app.use(express.static(path.join(__dirname,'public')));
app.use(bodyParser.urlencoded({ extended: true }));

//INSECURE
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var request = require('request');

var service_path = 'https://ibm-watson-ml.mybluemix.net';
var wml_username = process.env.wml_username;
var wml_password = process.env.wml_password;
var token_path = '/v3/identity/token';

console.log('WML username = ' + process.env.wml_username);
console.log('WML password = ' + process.env.wml_password);

const PGUSER = process.env.pg_user;
const PGHOST = (process.env.POSTGRES_RELEASE_POSTGRESQL_SERVICE_HOST || 'localhost');;
const PGPASSWORD = process.env.pg_password;
const PGDATABASE = 'churndb';
const PGPORT = (process.env.POSTGRES_RELEASE_POSTGRESQL_SERVICE_PORT || 5432);

console.log('postgres host = ' + PGHOST);
console.log('postgres port = ' + PGPORT);
console.log('postgres user = ' + PGUSER);
console.log('postgres password = ' + PGPASSWORD);

const scoring_endpoint = process.env.scoring_endpoint;
console.log('scoring endpoint = ' + scoring_endpoint);


const { Pool, Client } = require('pg')
const pool = new Pool({
  user: PGUSER,
  host: PGHOST,
  database: PGDATABASE,
  password: PGPASSWORD,
  port: PGPORT,
});
const client = new Client()



function tokenGet(wml_username, wml_password, service_path, token_path, loadCallback, errorCallback){
  request({
    method: "GET",
    url: service_path + token_path,
    auth: {
      'user': wml_username,
      'pass': wml_password
      }
    },
    function(error, response, body){
      console.log('error:', error); // Print the error if one occurred 
      console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received 
      // console.log('result:', body);
      var token = JSON.parse(body).token;
      console.log('TOKEN = ' + token);
      loadCallback(token);
    });
}



function score(scoring_endpoint, token, payload, loadCallback, errorCallback){
  request({
    method: "POST",
    headers: {'Content-Type': 'application/json', 'Authorization': token},
    url: scoring_endpoint,
    body: JSON.stringify(payload)
    //body: payload
    },
    function(error, response, body){
      console.log('error:', error); // Print the error if one occurred
      console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
      console.log('result:', body);

      var scoreResponse = JSON.parse(body);
      // console.log(scoreResponse);
      // console.log('probability = ' + scoreResponse["result"]["probability"]["values"][0]);
      loadCallback(scoreResponse);
    }, function (error) {
      console.log(error);
    });
}



app.get('/', function(req, res){
  res.render('input');
});

app.post('/', function (req, res) {
  RETIRE = Number(req.body.RETIRE)
  MORTGAGE = req.body.MORTGAGE
  LOC = req.body.LOC
  GENDER = req.body.GENDER
  CHILDREN = req.body.CHILDREN
  WORKING = req.body.WORKING
  HighMonVal = req.body.HighMonVal
  AgeRange = req.body.AgeRange
  Frequency_score = Number(req.body.Frequency_score)

  //console.log(typeof RETIRE);



tokenGet(wml_username, wml_password, service_path, token_path,
    function (token) {
      //console.log(token);

      var wmlToken = "Bearer " + token;

      var payload =   
        {
          "fields": [
            "Retire",
            "Mortgage",
            "LOC",
            "GENDER",
            "CHILDREN",
            "WORKING",
            "HighMonVal",
            "AgeRange",
            "Frequency_score"
          ],
          "values": [
            [
              RETIRE,
              MORTGAGE,
              LOC,
              GENDER,
              CHILDREN,
              WORKING,
              HighMonVal,
              AgeRange,
              Frequency_score
            ]
          ]
        };

        console.log(payload)


      score(scoring_endpoint, wmlToken, payload, function (scoreResponse) {
              prediction = scoreResponse.values[0][0];
              probability = scoreResponse.values[0][1][0];
              res.send(scoreResponse);
              console.log(prediction);
              console.log(probability);
              // res.render("index", { scoreResponse: scoreResponse, prediction:prediction, probability: probability })

              pool.connect((err, client, done) => {

                const shouldAbort = (err) => {
                  if (err) {
                    console.error('Error in transaction', err.stack)
                    client.query('ROLLBACK', (err) => {
                      if (err) {
                        console.error('Error rolling back client', err.stack)
                      }
                      // release the client back to the pool
                      done()
                    })
                  }
                  return !!err
                }

                client.query('BEGIN', (err) => {
                  if (shouldAbort(err)) return

                  const insertText = 'INSERT INTO public.churn(Retire, Mortgage, LOC, GENDER, CHILDREN, WORKING, HighMonVal ,AgeRange, Frequency_score, prediction, probability) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)'
                  const insertValues = [RETIRE, MORTGAGE, LOC, GENDER, CHILDREN, WORKING, HighMonVal ,AgeRange, Frequency_score, prediction, probability.toFixed(5)]
                  client.query(insertText, insertValues, (err, res) => {
                    if (shouldAbort(err)) return

                    client.query('COMMIT', (err) => {
                      if (err) {
                        console.error('Error committing transaction', err.stack)
                      }
                      done()
                    })
                  })
                })
              })


      }, function (error) {
        console.log(error);
      });

    }, function (err) {
      console.log(err);
    });

});


app.listen(app.get('port'), function(){
  console.log('Express started on port' + app.get('port') + ' press Ctrl-C to terminate');
});
