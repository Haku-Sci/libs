FROM postgres:latest

# Set default environment variables
# These can be overridden at runtime via docker run -e or in docker-compose
ENV POSTGRES_USER=admin
ENV POSTGRES_PASSWORD=password
ENV POSTGRES_DB=postgres

# Expose PostgreSQL port
EXPOSE 5432

# Use default postgres entrypoint and command
# The entrypoint handles initialization scripts in /docker-entrypoint-initdb.d/
