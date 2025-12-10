FROM neo4j:latest

# Install APOC and Graph Data Science plugins
ENV NEO4J_PLUGINS='["apoc", "graph-data-science"]'

# Enable JVM debug port
ENV _NEO4J_server_jvm_additional='-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005'

# Copy custom plugins if available (optional)
# If you have custom JAR files, place them in the same directory as this Dockerfile
# Uncomment the line below and add your JAR files to the docker/neo4j directory
# COPY --chown=neo4j:neo4j *.jar /var/lib/neo4j/plugins/

# Expose Neo4j ports
EXPOSE 7474 7687 5005

# Use default neo4j entrypoint
ENTRYPOINT ["/startup/docker-entrypoint.sh"]
CMD ["neo4j"]
