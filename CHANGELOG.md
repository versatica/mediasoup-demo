# CHANGELOG

This is the changelog of the mediasoup demo application. To check the changes in **mediasoup** and **mediasoup-client** libraries check their corresponding projects.


## 2019-03-17

* Moving app and server to mediasoup v3.


## 2019-02-11

* Remove transport max bitrate artificial limitation.


## 2019-01-25

* Update mediasoup to 2.6.8. It fixes a [crash](https://github.com/versatica/mediasoup/issues/258) in the C++ `TcpConnection` class.
* Update mediasoup-client to 2.4.9.


## 2019-01-16

* Update mediasoup to 2.6.7. It fixes a [wrong destruction](https://github.com/versatica/mediasoup/commit/2b76b620b92c15e41fbb5677a326a90f0f365c7e) of Transport C++ instances producing a loop and CPU usage at 100%.


## 2019-01-15

* Update mediasoup to 2.6.6. It fixes an important [port leak bug](https://github.com/versatica/mediasoup/issues/259).
