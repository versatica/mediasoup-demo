FROM node:10 AS stage-one

# Install DEB dependencies and others.
RUN \
	set -x \
	&& apt-get update \
	&& apt-get install -y build-essential \
	&& apt-get install -y valgrind

WORKDIR /service

COPY package.json .
RUN npm install
COPY server.js .
COPY config.js .
COPY lib lib
COPY certs certs

CMD ["node", "/service/server.js"]
