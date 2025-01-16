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

## launch.json

The launch.json file allows to run all services (the project libs must be in the same directory as "services", which contains all services)

## other

Finally, the method executeFunction into the utils library lets call dynamically the function of an object, with parameters
(Format: object as class, function name as string, parameters as dictionary)
