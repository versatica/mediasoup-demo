FROM node:8.9
ADD . /service
COPY config.example_docker.js /service/config.js
RUN cd /service && npm install
EXPOSE 3443
EXPOSE 40000-40200/udp
CMD ["node", "/service/server.js"]


