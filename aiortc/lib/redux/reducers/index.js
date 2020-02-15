"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redux_1 = require("redux");
const room_1 = __importDefault(require("./room"));
const me_1 = __importDefault(require("./me"));
const producers_1 = __importDefault(require("./producers"));
const dataProducers_1 = __importDefault(require("./dataProducers"));
const peers_1 = __importDefault(require("./peers"));
const consumers_1 = __importDefault(require("./consumers"));
const dataConsumers_1 = __importDefault(require("./dataConsumers"));
const reducers = redux_1.combineReducers({
    room: room_1.default,
    me: me_1.default,
    producers: producers_1.default,
    dataProducers: dataProducers_1.default,
    peers: peers_1.default,
    consumers: consumers_1.default,
    dataConsumers: dataConsumers_1.default
});
exports.default = reducers;
