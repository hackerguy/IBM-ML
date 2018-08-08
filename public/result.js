$(document).ready(function() {
console.log("ready!");

$('#prediction').html("Prediction = " + "Churn")
$('#probability').html("Probability of Churn = " + "69.90" + "%");
chart(47.14)

	// on form submission ...
  	// $('form').on('submit', function() {
  	$('.onchange').on('change', function() {
     	// $('form').submit();
  		// console.log("the form has beeen submitted");

  	// grab values
  	RETIRE  = $('input[name="RETIRE"]:checked').val();
  	MORTGAGE = $('input[name="MORTGAGE"]:checked').val();
	LOC = $('input[name="LOC"]:checked').val();
	GENDER = $('input[name="GENDER"]:checked').val();
	CHILDREN = $('input[name="CHILDREN"]:checked').val();
	WORKING  = $('input[name="WORKING"]:checked').val();
	HighMonVal  = $('input[name="HighMonVal"]:checked').val();
	AgeRange  = $('input[name="AgeRange"]:checked').val();
	Frequency_score  = $('input[name="Frequency_score"]:checked').val();


	console.log(RETIRE, MORTGAGE, LOC, GENDER, CHILDREN, WORKING, HighMonVal, AgeRange, Frequency_score)


  	$.ajax({
  		type: "POST",
  		url: "/",
  		data : { 'RETIRE': RETIRE, 'MORTGAGE': MORTGAGE, 'LOC': LOC, 'GENDER': GENDER,
  			'CHILDREN': CHILDREN, 'WORKING': WORKING, 'HighMonVal': HighMonVal,
  			'AgeRange': AgeRange, 'Frequency_score': Frequency_score
			 },
		success: function(results) {
			console.log(results.values);
			if (results) {
				if (results.values[0][0] === 0) {
    				prediction = "Not Churn";
    			} else if (results.values[0][0] === 1) {
    				prediction = "Churn";
    			} else {
    				prediction = "No Prediction";
    			}
    			probability = results.values[0][1][1]
    			console.log(prediction);
    			console.log(probability);
    			$('#prediction').html("Prediction = " + prediction)
				$('#probability').html("Probability of Churning = " + (probability*100).toFixed(2) + "%");
				chart(probability)

			} else {
				console.log("Something went wrong with the prediction");
				$('.result').html('Something went wrong with the prediction.')

			}
		},

		error: function(error) {
			console.log(error)
		}

		});
	
	});

});