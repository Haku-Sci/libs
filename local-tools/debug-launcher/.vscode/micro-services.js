window.servicesData = {
  "services": {    
    "Front": {
      "displayName": "Front",
      "description": "React/Next.js Frontend",
      "vpc": 0,
      "consul": false,
      "dependencies": ["Api", "Collab"]
    },
    "Collab": {
      "displayName": "Collab Server",
      "description": "Collaboration WebSocket server",
      "vpc": 0.5,
      "consul": true,
      "url": "https://test.collab.haku-sci.com",
      "dependencies": ["Api", "Third-party"]
    },
    "Api": {
      "displayName": "Api",
      "description": "Main REST API",
      "vpc": 0.5,
      "consul": false,
      "url": "https://test.api.haku-sci.com",
      "dependencies": ["Confidential-properties","Graph", "Confidential-properties","Third-party"]
    },
    "Graph": {
      "displayName": "Graph",
      "description": "Neo4j Graph Database Service",
      "vpc": 1,
      "consul": true,
      "dependencies": ["Third-party"]
    },
    "Confidential-properties": {
      "displayName": "Confidential Properties",
      "description": "Configuration service",
      "vpc": 1,
      "consul": true,
      "dependencies": ["Third-party"]
    },    
    "Third-party": {
      "displayName": "Third Party",
      "description": "External APIs integration",
      "vpc": 0.5,
      "consul": true
    }
  },
  "consul": {
    "name": "consul",
    "url":"http://test.hubs.haku-sci.com:8500"
  }
}