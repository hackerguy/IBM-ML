function chart(probability) {
  
  var ctx = document.getElementById('myChart');
  ctx.width = 200;
  ctx.height = 200;

  data = {
    labels: ['Churn', 'Not Churn'],
    datasets: [{
        label: "Probability of Churn",
        backgroundColor: ['rgba(190, 108, 118, 1)', 'rgba(63, 107, 138, 1)'],
        data: [probability, (1-probability)]
    }],
  };

  var myDoughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: data
  });
}