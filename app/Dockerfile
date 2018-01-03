FROM node:8.9
ADD certs /service/certs
ADD server /service/server
ADD . /service
# App
RUN cd /service/ && npm install
RUN npm i -g gulp-cli
RUN npm i gulp
EXPOSE 3000 3001
CMD cd /service && gulp live
