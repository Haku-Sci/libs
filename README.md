# Description of the utils inside this package

This package is used by Haku-Sci, to handle different contents.

## Microservices

Loading the class MicroserviceLib, it allows to fetch:

* The name of the current microservice
* default bootstrap for microservices

### Consul

if consul is used, and env variabe CONSUL_URI is defined, then the lib allows as well:

* to send messages to other services via TCP, and fetch the response if any
* to emit message for all services via RabbitMQ

## Docker

the start_services.bat method allows to run all required services from docker:

* Consul
* Neo4j
* Postgresql
* RabbitMQ

## PostgreSQL

if the service uses a database PostgreSQL, and this database doesn't exist in the system, it will be created automatically (require the librarie pg)

## RabbitMQ

Using RabbitMQService, lets implement dispatch of messages with an option to wait that all messages have been processed. A watchdog of 10 seconds raise an error Gateway timeout
If the option is activated, a queue ack_queue_\<name of the microservice\> is created  

The decorator HakuSciSubscriber allows to listen for a specific keyword.
Each microservice which register with this decorator will have automatically a queue created, with its name.
The exchanger is amq.topic

## launch.json

The launch.json file allows to run all services (the microservice libs must be in the same directory as "services", which contains all services)

## utils

### executeFunction

lets call dynamically the function of an object, with parameters
(Format: object as class, function name as string, parameters as dictionary)

### getSortedParameters

for a function, get available parameters as dictionary, and return a list of parameters in correct order, to be run for this function (...args)

### withWatchdog

Add a watchdog to a promise
