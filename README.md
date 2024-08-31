# Description of the utils inside this package

This package is used by Haku-Sci, to handle microservices.
It allows to fetch:

* The name of the current microservice
* The list of services for configuration (Based on the environment variable "SERVICES"), and their port
* The port of the current microservice (Based on the environment variable "SERVICES" and this service's name)
* default bootstrap for microservices
