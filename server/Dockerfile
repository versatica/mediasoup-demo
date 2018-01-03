FROM node:8.9
ADD . /service
COPY config.example.js /service/config.js
RUN cd /service && npm install
EXPOSE 3443
CMD ["node", "/service/server.js"]


