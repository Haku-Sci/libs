# Description of the utils inside this package

This package is used by Haku-Sci, to handle microservices.
Loading the class MicroserviceLib, it allows to fetch:

* The name of the current microservice
* default bootstrap for microservices

if consul is used, and env variabe CONSUL_URI is defined, then the lib allows as well to send messages to other services via TCP, and fetch the response if any.
