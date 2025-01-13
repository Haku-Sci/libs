#consul
docker run --name consul-container -d -p 8500:8500 -p 8600:8600/udp -v consul_data:/consul/data -e CONSUL_BIND_INTERFACE=eth0 consul:1.15.4
#rabbitmq
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
#postgresql
docker run --name postgres-container -d -p 5432:5432 -v postgres_data:/var/lib/postgresql/data -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin123 -e POSTGRES_DB=mydatabase postgres:15
#neo4j
docker run --name neo4j-container -d -p 7474:7474 -p 7687:7687 -v neo4j_data:/data -v neo4j_logs:/logs -v neo4j_import:/var/lib/neo4j/import -e NEO4J_AUTH=neo4j/password_neo4j neo4j:5