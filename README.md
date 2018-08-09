# MACHINE LEARNING ON IBM CLOUD

## Overview

This repository contains a set of assets to demonstrate the development and deployment of a cognitive application on IBM Cloud. In this demonstration, you will build a machine learning model to predict the likelihood that a retail customer will churn, deploy a cognitive application that employs this model to score customers on their likelihood to churn, and store the scoring results in a database for further analysis.

The demo begins with ingesting two data sets - one with customer demographic information and the other with customer transaction history, joining, cleansing, and preparing the data for machine learning, training and evaluating a machine learning model to predict customer churn, and deploying the model as a REST API endpoint. An application is then deployed that hits this endpoint to score customers based on the highly predictive features on which the model was trained. Results of each scoring request are then stored in a database.

## <a name="toc"></a>Table of Contents

* [Demo Flow](#demo-flow)
* [Prerequisites](#prerequisites)
* [Instructions](#instructions)
	* [Build, save and deploy the machine learning model](#build)
	* [Provision cluster in IBM Cloud Kubernetes Service](#provision)
	* [Deploy PostgreSQL](#postgres)
	* [Deploy the application](#app)
	* [Score the model](#score)
	* [Investigate the scoring results written to the PostgreSQL database](#database)
* [Summary](#summary)

## <a name="demo-flow"></a>Demo Flow


In this demo, you will use IBM Watson Studio to develop the retail churn machine learning model in a Jupyter notebook. The Jupyter notebook is written in Python and utilizes Pandas, scikit-learn and XGBoost to cleanse the data, transform it, and learn a machine learning model. 

IBM Watson Machine Learning (WML) is then used a repository for storing the model and deploying it as a publically accessibe REST API endpoint.

A Node.js web application used to score the model is containerized, deployed in Kubernetes on the IBM Cloud Kubernetes Service, and its URL made publically accessible so that it can be accessed in any brower over the internet. A PostgreSQL database is also deployed in the IBM Cloud Kubernetes Service. The Node.js application writes the scoring request and the predictions from the deployed machine learning model in WML into the database.

![Demo Flow](img/Flow.png)


Upon scoring customers with the web application, the feature values scored along with the model prediction results, both the churn prediction as well as the probability of chrun are inserted into a PostgreSQL database table. The table columns correpond to the nine features used to train the model along with two additional columns for the prediction result and the probability.

![postgres](img/postgres.png)


## <a name="prerequisites"></a>Prerequisites

* IBM Cloud account
	* <https://console.bluemix.net/>
* Watson Studio account
	* <https://dataplatform.cloud.ibm.com/>


## <a name="instructions"></a>Instructions

### <a name="build"></a>Build, save and deploy the machine learning model

In Watson Studio:

* Create a project
* Add a WML service to the project
* Create a notebook from the .ipynb file included in this repository
* Insert the credentials with the WML service you just provisioned into the notebook
* Run all cells in the notebook

You should now have a model and deployment in your project.

### <a name="provision"></a>Provision cluster in IBM Cloud Kubernetes Service

Download and install IBM Cloud CLI tools and the IBM Kubernetes Service plug-in.       
              
For Mac and Linux, run the following command:

	$ curl -sL https://ibm.biz/idt-installer | bash
	
For Windows 10 Pro, run the following command as an administrator:   
(Right-click the Windows PowerShell icon, and select Run as administrator.)

	C:\> Set-ExecutionPolicy Unrestricted; iex(New-Object Net.WebClient).DownloadString('http://ibm.biz/idt-win-installer')
	
Log in to your IBM Cloud account.
	
	$ ibmcloud login -a https://api.ng.bluemix.net
	
Create a free cluster.

	$ ibmcloud ks cluster-create --name IBM-ML
	
Check status of cluster. The state of the cluser will initially be 'requested'. The state will then change to 'deploying', then 'pending' and eventually to 'normal'.	

	$ ibmcloud ks clusters

***You can NOT proceed further with the lab until the cluster is created and the status show as 'normal'.***
	
Target the IBM Cloud Container Service region where the cluster was provisioned.

	$ ibmcloud cs region-set us-south	
	
Get the command to set the environment variable and download the Kubernetes configuration files.

	$ ibmcloud cs cluster-config IBM-ML
	
Set the KUBECONFIG environment variable. Copy the output from the previous command and paste it in your terminal. The command output should look similar to the following.

	$ export KUBECONFIG=/Users/richtarro/.bluemix/plugins/container-service/clusters/IBM-ML/kube-config-hou02-IBM-ML.yml
		
Verify that you can connect to your cluster by listing your worker nodes. As you  created a free cluster, you will only see one worker node.

	$ kubectl get nodes


### <a name="postgres"></a>Deploy PostgreSQL

Install helm as we will install postgresSQL using a Helm chart. Instructions for installing Helm can be found at <https://github.com/helm/helm>. Scroll down to the Install section and follow the directions for installing Helm.

Initialize the local CLI and also install Tiller into your Kubernetes cluster.

	$ helm init

`$ helm install --name postgres-release --set postgresUser=user,postgresPassword=password,postgresDatabase=churndb,persistence.enabled=false stable/postgresql`

Get your PostgreSQL user password

	$ PGPASSWORD=$(kubectl get secret --namespace default postgres-release-postgresql -o jsonpath="{.data.postgres-password}" | base64 --decode; echo)
	
Connect to your PostgreSQL database
	
	$ kubectl run --namespace default postgres-release-postgresql-client --restart=Never --rm --tty -i --image postgres --env "PGPASSWORD=$PGPASSWORD" --command -- psql -U user -h postgres-release-postgresql churndb
	
You will see the PostgreSQL interactive terminal (psql) prompt.

`If you don't see a command prompt, try pressing enter.`  
`churndb=#`

Create the table for storing the churn predictions by cutting and pasting the following table create statement into psql.

```
-- Table: public.churn

-- DROP TABLE public.churn;

CREATE TABLE public.churn
(
    retire integer,
    mortgage text COLLATE pg_catalog."default",
    loc text COLLATE pg_catalog."default",
    gender text COLLATE pg_catalog."default",
    children text COLLATE pg_catalog."default",
    working text COLLATE pg_catalog."default",
    highmonval text COLLATE pg_catalog."default",
    agerange text COLLATE pg_catalog."default",
    frequency_score integer,
    prediction integer,
    probability double precision
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.churn
    OWNER to postgres;
    
```
Exit from psql by typing '\q' at the psql prompt.

	churndb-# \q
	
***Only exit from psql. Do NOT close the terminal.***
	
### <a name="app"></a>Deploy the application

#### Get the application code

Clone the source code for the application.

	$ git clone https://github.com/hackerguy/IBM-ML.git

Change directory.

	$ cd IBM-ML/app
	

#### Upload code to the IBM Cloud Container Registry
	
Log in to the IBM Cloud Container Registry CLI.
	
	$ ibmcloud cr login
	
You must set at least one namespace before you can push a Docker image to IBM Cloud Container Registry.

	$ ibmcloud cr namespace-add ibm-ml
	
Build the app as a Docker image in IBM Cloud Container Registry.
	
	$ ibmcloud cr build -t registry.ng.bluemix.net/ibm-ml/ibm-ml:1.0 .
	
#### Create the Kubernetes secrets

Create the secret for WML. Replace wml_username and wml_password values with the credentials from you WML service.
	
`$ kubectl create secret generic wml-secret --from-literal=wml_username='4be82790-d71b-4c9f-ac4e-5af3c4b9c9b1' --from-literal=wml_password='47571902-8632-47e8-9590-323f49975136'`

Create the secret for PostgreSQL.

	$ kubectl create secret generic pg-secret --from-literal=pg_user='user' --from-literal=pg_password='password'
	
#### Deploy the Docker image to Kubernetes

	$ kubectl create -f yaml/ibm-ml-deployment.yaml
	
#### Create a Kubernetes service

	$ kubectl expose deployment/ibm-ml-deployment --type=NodePort --port=3000 --name=ibm-ml-service
	
#### Display the service details

	$ kubectl describe service ibm-ml-service

The output should look like this.

```
Name:                     ibm-ml-service
Namespace:                default
Labels:                   run=ibm-ml-deployment
Annotations:              <none>
Selector:                 run=ibm-ml-deployment
Type:                     NodePort
IP:                       172.21.189.104
Port:                     <unset>  3000/TCP
TargetPort:               3000/TCP
NodePort:                 <unset>  32482/TCP
Endpoints:                172.30.206.75:3000
Session Affinity:         None
External Traffic Policy:  Cluster
Events:                   <none>
```

Find the NodePort. The NodePort you would want from the service description above is '32482'.

Get the IP address of the Kubernetes cluster worker node where the application is running. Again, as this is a free cluster, there is only one worker node.

	$ ibmcloud ks workers --cluster IBM-ML
	
```
ID                                                 Public IP         Private IP      Machine Type   State    Status   Zone    Version   
kube-hou02-pa551ca23425854181a04a73c495951366-w1   184.172.234.202   10.76.154.165   free           normal   Ready    hou02   1.10.5_1517
```
Find the Public IP. The Public IP you would want from output above would be '184.172.234.202'.

### <a name="score"></a>Score the model

In a web browser, go to https://Public IP:NodePort. For example, <http://184.172.234.202:32482>.

***This URL will not work for you. Make sure to replace the Public IP and the Node Port with the values associated with your Kubernetes cluster and service deployment that you found above.***

The Node.js web application should look like this.

![app](img/app.jpg)

Change any of the radio button inputs, representing the features on which the machine learning model was trained, to rescore the model and display the prediction associated with the set of input features.

The application is designed to rescore the machine learning model and update the prediction EVERY time an input feature is changed using the radio buttons. Each time an input feature is changed, the values of the input features and the churn prediction are written to the PostgreSQL database table as a new row.

Let now take a look at the data you've written to the database.

### <a name="database"></a>Investigate the scoring results written to the PostgreSQL database

Go back to PostgreSQL interactive terminal.

	$ kubectl run --namespace default postgres-release-postgresql-client --restart=Never --rm --tty -i --image postgres --env "PGPASSWORD=$PGPASSWORD" --command -- psql -U user -h postgres-release-postgresql churndb

You should be at the psql prompt that looks like this.

	churndb=#

Run the following SQL query to show all rows in the table.

	select * from public.churn;
	
You should see results that look like this.

```
 retire | mortgage | loc | gender | children | working | highmonval | agerange | frequency_score | prediction | probability 
--------+----------+-----+--------+----------+---------+------------+----------+-----------------+------------+-------------
      1 | Yes      | Yes | Male   | Yes      | Yes     | Yes        | 17 to 22 |               1 |          1 |     0.32192
(1 row)

```
Change another radio input in the web app, rerun the SQL query, and notice how each time you change a radio button, a new row is added to the database table.

```
 retire | mortgage | loc | gender | children | working | highmonval | agerange | frequency_score | prediction | probability 
--------+----------+-----+--------+----------+---------+------------+----------+-----------------+------------+-------------
      1 | Yes      | Yes | Male   | Yes      | Yes     | Yes        | 17 to 22 |               1 |          1 |     0.32192
      1 | Yes      | Yes | Male   | Yes      | Yes     | Yes        | 60 to 70 |               1 |          1 |     0.17499
(2 rows)
```
## <a name="summary"></a>Summary

In this demo, you've worked through an entire machine learning model life cyle - from data to deployment of cognitive application that employs the model you created.

[Back to Table of Contents](#toc)






 