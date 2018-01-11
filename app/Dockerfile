FROM node:8.9
ADD certs /service/certs
ADD app_out /service/app_out
ADD . /service
# App
RUN cd /service/ && npm install
RUN npm i -g gulp-cli
RUN npm i gulp
EXPOSE 3000 3001
CMD cd /service && gulp live
