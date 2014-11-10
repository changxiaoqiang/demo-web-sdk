;
(function () {
    /**
     * Created by zhangyatao on 2014/10/14.
     */
//二进制帮助类
    (function () {
        var func = function () {
            var script = document.createElement("script");
            if (this.WebSocket && this.ArrayBuffer) {
                script.src = "http://webim.rongcloud.net/WebIMDemo/static/js/protobuf.min.js";
            } else {
                script.src = "flash_plugins/swfobject.min.js";
            }
            document.head.appendChild(script);
        };
        if (window.attachEvent) {
            window.attachEvent("onload", func);
        } else {
            window.addEventListener("load", func, false);
        }
    })();

    var binaryHelper = {
        init: function (array) {
            for (var i = 0; i < array.length; i++)
                if (array[i] < 0)
                    array[i] += 256;
            return array;
        },
        writeUTF: function (str, isgetbytes) {
            var back = [],
                bytesize = 0,
                binaryPool = ["0xxxxxxxx", "110xxxxx 10xxxxxx", "1110xxxx 10xxxxxx 10xxxxxx", "11110xxx 10xxxxxx 10xxxxxx 10xxxxxx"];
            for (var i = 0; i < str.length; i++) {
                var type = 0,
                    code = str.charCodeAt(i),
                    bin = code.toString(2);
                if (code >= 0 && code <= 127) {
                    bytesize += 1;
                    back.push(code);
                    continue;
                } else if (code >= 128 && code <= 2047) {
                    bytesize += 2;
                    type = 1;
                } else if (code >= 2048 && code <= 65535) {
                    bytesize += 3;
                    type = 2;
                }
                var temp = binaryPool[type].split(" "),
                    val = bin.slice(0, bin.length - 6 * type);
                if (val.length < 6 - type) {
                    var zz = "";
                    for (var z = 0; z < 6 - type - val.length; z++) {
                        zz += "0";
                    }
                    val = zz + val;
                }
                var wa = "";
                for (var l = 0; l < 6 - type; l++) {
                    wa += "x";
                }
                back.push(parseInt(temp[0].replace(wa, val), 2));
                for (var t = 0; t < type; t++) {
                    back.push(parseInt(temp[t + 1].replace("xxxxxx", bin.slice(bin.length - (type - t) * 6, bin.length - (type - t - 1) * 6)), 2));
                }
            }
            if (isgetbytes) {
                return back;
            }
            if (bytesize <= 255) {
                back = [0, bytesize].concat(back);
            } else {
                var bl = bytesize.toString(2);
                back = [parseInt(bl.slice(0, bl.length - 8), 2), parseInt(bl.slice(bl.length - 8), 2)].concat(back);
            }
            return back;
        },
        readUTF: function (arr) {
            var UTF = "", _arr = this.init(arr);
            for (var i = 0; i < _arr.length; i++) {
                var one = _arr[i].toString(2),
                    v = one.match(/^1+?(?=0)/);
                if (v && one.length == 8) {
                    var bytelength = v[0].length,
                        store = _arr[i].toString(2).slice(7 - bytelength);
                    for (var st = 1; st < bytelength; st++)
                        store += _arr[st + i].toString(2).slice(2);
                    UTF += String.fromCharCode(parseInt(store, 2));
                    i += bytelength - 1;
                } else {
                    UTF += String.fromCharCode(_arr[i]);
                }
            }
            return UTF;
        },
        convertStream: function (x) {
            if (x instanceof RongIMStream) {
                return x;
            } else {
                return new RongIMStream(x);
            }
        },
        toMQttString: function (str) {
            return this.writeUTF(str);
        },
        skey: [108, 77, 21, 33, 16, 39, 22, 119],
        obfuscation: function (data, start) {
            var dataLen = data.length,
                b = 0,
                _data = data,
                convertTobyte = function (x) {
                    if (x > 255)
                        return parseInt(x.toString(2).slice(-8), 2);
                    return x;
                };
            for (var i = start; i < dataLen; i += this.skey.length) {
                b = i;
                for (var j = 0; j < skeyLen && b < dataLen; j++, b++) {
                    _data[b] = convertTobyte(_data[b] ^ this.skey[j]);
                }
            }
            return _data;
        }
    };

    var RongIMStream = function (arr) {
        var pool = binaryHelper.init(arr),
            check = (function (z) {
                return function (x) {
                    return z.position >= pool.length;
                };
            })(this);
        this.position = 0;
        this.writen = 0;
        function baseRead(m, i, a) {
            var t = a ? a : [];
            for (var start = 0; start < i; start++) {
                t[start] = pool[m.position++];
            }
            return t;
        }

        this.readLong = function () {
            if (check()) {
                return -1;
            }
            var end = "";
            for (var i = 0; i < 8; i++) {
                end += pool[this.position++].toString(16);
            }
            return parseInt(end, 16);
        };
        this.readInt = function () {
            if (check()) {
                return -1;
            }
            var end = "";
            for (var i = 0; i < 4; i++) {
                end += pool[this.position++].toString(16);
            }
            return parseInt(end, 16);
        };
        this.readByte = function () {
            if (check()) {
                return -1;
            }
            var tempval = pool[this.position++];
            if (tempval > 255) {
                tempval = parseInt(tempval.toString(2).slice(-8), 2);
            }
            return tempval;
        };
        this.read = function (bytesArray) {
            if (check()) {
                return -1;
            }
            if (bytesArray) {
                baseRead(this, bytesArray.length, bytesArray);
            } else {
                return baseRead(this, 1)[0];
            }
        };
        this.readUTF = function () {
            var _offset = this.position,
                back = {
                    UTF: "",
                    offset: 0
                },
                arr = pool;
            var bl = arr.slice(_offset, _offset + 2),
                len = bl[1].toString(16);
            if (len.length < 2)
                len = "0" + len;
            back.offset = 2 + parseInt(bl[0].toString(16) + len, 16);
            for (var i = _offset + 2; i < _offset + back.offset; i++) {
                var one = arr[i].toString(2),
                    v = one.match(/^1+?(?=0)/);
                if (v && one.length == 8) {
                    var bytelength = v[0].length,
                        store = arr[i].toString(2).slice(7 - bytelength);
                    for (var st = 1; st < bytelength; st++)
                        store += arr[st + i].toString(2).slice(2);
                    back.UTF += String.fromCharCode(parseInt(store, 2));
                    i += bytelength - 1;
                } else {
                    back.UTF += String.fromCharCode(arr[i]);
                }
            }
            this.position += back.offset;
            return back.UTF;
        };

        this.write = function (_byte) {
            var b = _byte;
            if (Object.prototype.toString.call(b).toLowerCase() == "[object array]") {
                pool = pool.concat(b);
            } else if (+b == b) {
                if (b > 255) {
                    var s = b.toString(2);
                    b = parseInt(s.slice(s.length - 8), 2);
                }
                pool.push(b);
                this.writen++;
            }
            return b;
        };
        this.writeChar = function (v) {
            if (+v != v)
                throw new Error("arguments type is error");
            this.write((v >> 8) & 0xFF);
            this.write(v & 0xFF);
            this.writen += 2;
        };
        this.writeUTF = function (str) {
            var back = [],
                bytesize = 0;
            for (var i = 0; i < str.length; i++) {
                var code = str.charCodeAt(i);
                if (code >= 0 && code <= 127) {
                    bytesize += 1;
                    back.push(code);
                } else if (code >= 128 && code <= 2047) {
                    bytesize += 2;
                    back.push((0xc0 | (0x1f & (code >> 6))));
                    back.push((0x80 | (0x3f & code)));
                } else if (code >= 2048 && code <= 65535) {
                    bytesize += 3;
                    back.push((0xe0 | (0x0f & (code >> 12))));
                    back.push((0x80 | (0x3f & (code >> 6))));
                    back.push((0x80 | (0x3f & code)));
                }
            }
            for (i = 0; i < back.length; i++) {
                if (back[i] > 255) {
                    var s = back[i].toString(16);
                    back[i] = parseInt(s.slice(s.length - 2), 16);
                }
            }
            if (bytesize <= 255) {
                pool = pool.concat([0, bytesize].concat(back));
            } else {
                var bl = bytesize.toString(16);
                pool = pool.concat([parseInt(bl.slice(0, bl.length - 2), 16), parseInt(bl.slice(bl.length - 2), 16)].concat(back));
            }
            //this.position += back.length + 2;
            this.writen += back.length + 2;
        };
        this.writeLong = function (v) {
            this.write(0xff & (v >> 56));
            this.write(0xff & (v >> 48));
            this.write(0xff & (v >> 40));
            this.write(0xff & (v >> 32));
            this.write(0xff & (v >> 24));
            this.write(0xff & (v >> 16));
            this.write(0xff & (v >> 8));
            this.write(0xff & v);
            this.writen += 8;
        };
        this.writeInt = function (v) {
            this.write(0xff & (v >> 24));
            this.write(0xff & (v >> 16));
            this.write(0xff & (v >> 8));
            this.write(0xff & v);
            this.writen += 4;
        };
        //补码  先取反再加1
        this.toComplements = function () {
            var _tPool = pool;
            for (var i = 0; i < _tPool.length; i++)
                if (_tPool[i] > 128)
                    _tPool[i] -= 256;
            return _tPool;
        };
        this.getBytesArray = function (isCom) {
            if (isCom) {
                return this.toComplements();
            }
            return pool;
        };
    };
    /**
     * Created by zhangyatao on 2014/10/9. message
     */
    var Qos = function (i) {
        var val = 0;
        if (i)
            val = i;
        this.AT_MOST_ONCE = 0;
        this.AT_LEAST_ONCE = 1;
        this.EXACTLY_ONCE = 2;
        this.DEFAULT = 3;
        this.currentValue = function () {
            return val;
        }
    }, type = function (i) {
        var val = 0;
        if (i)
            val = i;
        this.CONNECT = 1;
        this.CONNACK = 2;
        this.PUBLISH = 3;
        this.PUBACK = 4;
        this.QUERY = 5;
        this.QUERYACK = 6;
        this.QUERYCON = 7;
        this.PINGREQ = 12;
        this.PINGGRESP = 13;
        this.DISCONNECT = 14;
        this.currentValue = function () {
            return val;
        }
    }, ConnectionState = function (i) {
        var val = 0;
        val = i;
        this.ACCPTED = 0;
        this.UNACCEPTABLE_PROTOCOL_VERSION = 1;
        this.IDENTIFIER_REHECTED = 2;
        this.SERVER_UNAVAILABLE = 3;
        this.BAD_USEERNAME_OR_PASSWORD = 4;
        this.NOT_AUTHORIZED = 5;
        this.REDIRECT = 6;
        this.getValue = function () {
            return val;
        }
    }, DisconnectionStatus = function (i) {
        var val = i || 0, msg = {1: "重连", 2: "其他设备登陆", 3: "关闭"};
        this.getMessage = function (val) {
            return msg[val];
        };
        this.RECONNECT = 1;
        this.OTHER_DEVICE_LOGIN = 2;
        this.CLOSURE = 3;
        this.getValue = function () {
            return val;
        }
    };
    Qos.valueOf = function (i) {
        return new Qos(i);
    };
    type.valueOf = function (i) {
        return new type(i);
    };

    function Message(type) {
        var _header, _headerCode, lengthSize = 0;

        if (type instanceof Header) {
            _header = type;
        } else {
            _header = new Header(type, false, new Qos(0), false);
        }
        this.read = function (In, length) {
            this.readMessage(In, length);
        };

        this.write = function (Out) {
            var out = binaryHelper.convertStream(Out);
            _headerCode = _header.encode();
            out.write(_headerCode);
            this.writeMessage(out);
            this.addEmpty(out);
            return out;
        };

        function readMsgLength(In) {
            var msgLength = 0, multiplier = 1, digit, _in = binaryHelper.convertStream(In);
            do {
                digit = _in.read();
                msgLength += (digit & 0X7f) * multiplier;
                multiplier *= 128;
            } while ((digit & 0X80) > 0);//等同于>0
            return msgLength;
        }

        function writeMsgLength(Out, main) {
            var out = binaryHelper.convertStream(Out), val = main.messageLength();
            do {
                lengthSize++;
                var b = val & 0X7F;
                val >>= 7;
                if (val > 0) {
                    b |= 0X80;
                }
                if (b > 255) {
                    var _byte = b.toString(2);
                    b = parseInt(_byte.slice(_byte.length - 8), 2);
                }
                out.write(b);
            } while (val > 0);
            return out;
        }

        function writeMsgCode(Out, main) {
            var val = main.messageLength(), code = _headerCode, out = binaryHelper.convertStream(Out);
            do {
                var b = val & 0X7F;
                val >>= 7;
                if (val > 0) {
                    b |= 0X80;
                }
                code = code ^ b;
            } while (val > 0);
            if (code > 255) {
                var _byte = code.toString(2);
                code = parseInt(_byte.slice(_byte.length - 8), 2);
            }
            out.write(code);
            return out;
        }

        this.getLengthSize = function () {
            return lengthSize;
        };

        this.toBytes = function () {
            return this.write([]).getBytesArray();
        };
        this.setRetained = function (retain) {
            _header.retain = retain;
        };
        this.isRetained = function () {
            return _header.retain;
        };
        this.setQos = function (qos) {
            _header.qos = qos;
        };
        this.getQos = function () {
            return _header.qos;
        };
        this.setDup = function (dup) {
            _header.dup = dup;
        };
        this.isDup = function () {
            return _header.dup;
        };
        this.getType = function () {
            return _header.type;
        };
        this.messageLength = function () {
            return 0;
        };
        this.writeMessage = function (out) {
        };
        this.readMessage = function (In) {
        };
        this.addEmpty = function (out) {

        };
    }

    Message.name = "Message";

    function Header(_type, _retain, _qos, _dup) {
        this.type = null;
        this.retain = false;
        this.qos = new Qos(1);
        this.dup = false;
        if (_type && +_type == _type && arguments.length == 1) {
            this.retain = (_type & 1) > 0, this.qos = Qos.valueOf((_type & 0X6) >> 1), this.dup = (_type & 8) > 0, this.type = type.valueOf((_type >> 4) & 0XF);
        } else {
            this.type = _type, this.retain = _retain, this.qos = _qos, this.dup = _dup;
        }
        this.getType = function () {
            return  this.type;
        };
        this.encode = function () {
            var _byte = 0;
            _byte = (this.type.currentValue() << 4);
            _byte |= this.retain ? 1 : 0;
            _byte |= this.qos.currentValue() << 1;
            _byte |= this.dup ? 8 : 0;
            return _byte;
        };
        this.toString = function () {
            return "Header [typ" + this.type.currentValue() + ",retain=" + this.retain + ",qos=" + this.qos.currentValue() + ",dup=" + this.dup + "]";
        };
    }

    /**
     * Created by zhangyatao on 2014/10/10.
     */
    function ConnectMessage() {
        var CONNECT_HEADER_SIZE = 12, protocolId = "RCloud", protocolVersion = 3, clientId, keepAlive, appId, token, cleanSession, willTopic, will, willQos, retainWill, hasAppId, hasToken, hasWill;

        switch (arguments.length) {
            case 0:
                Message.call(this, new type(1));
                break;
            case 1:
                Message.call(this, arguments[0]);
                break;
            case 3:
                Message.call(this, new type(1));
                if (!arguments[0] || arguments.length > 64)
                    throw new Error("Client id cannot be null and must be at most 64 characters long: " + arguments[0]);
                clientId = arguments[0];
                cleanSession = arguments[1];
                keepAlive = arguments[2];
                break;
        }
        //override
        this.messageLength = function () {
            var payloadSize = binaryHelper.toMQttString(clientId).length;
            payloadSize += binaryHelper.toMQttString(willTopic).length;
            payloadSize += binaryHelper.toMQttString(will).length;
            payloadSize += binaryHelper.toMQttString(appId).length;
            payloadSize += binaryHelper.toMQttString(token).length;
            return payloadSize + CONNECT_HEADER_SIZE;
        };
        this.readMessage = function (In, length) {
            var stream = binaryHelper.convertStream(In);
            protocolId = stream.readUTF();
            protocolVersion = stream.readByte();//readByte()
            var cFlags = stream.readByte();
            hasAppId = (cFlags & 0x80) > 0;
            hasToken = (cFlags & 0x40) > 0;
            retainWill = (cFlags & 0x20) > 0;
            willQos = Qos.valueOf(cFlags >> 3 & 0x03).currentValue();
            hasWill = (cFlags & 0x04) > 0;
            cleanSession = (cFlags & 0x20) > 0;
            keepAlive = stream.read() * 256 + stream.read();
            clientId = stream.readUTF();
            if (hasWill) {
                willTopic = stream.readUTF();
                will = stream.readUTF();
            }
            if (hasAppId) {
                try {
                    appId = stream.readUTF();
                } catch (ex) {

                }
            }
            if (hasToken) {
                try {
                    token = stream.readUTF();
                } catch (ex) {

                }
            }
            return stream;
        };
        this.writeMessage = function (out) {
            var stream = binaryHelper.convertStream(out);
            stream.writeUTF(protocolId);
            stream.write(protocolVersion);
            var flags = cleanSession ? 2 : 0;
            flags |= hasWill ? 0x04 : 0;
            flags |= willQos ? willQos >> 3 : 0;
            flags |= retainWill ? 0x20 : 0;
            flags |= hasToken ? 0x40 : 0;
            flags |= hasAppId ? 0x80 : 0;
            stream.write(flags);
            stream.writeChar(keepAlive);
            stream.writeUTF(clientId);
            if (hasWill) {
                stream.writeUTF(willTopic);
                stream.writeUTF(will);
            }
            if (hasAppId) {
                stream.writeUTF(appId);
            }
            if (hasToken) {
                stream.writeUTF(token);
            }
            return stream;
        };

        this.setCredentials = function (appid, _token) {
            if ((!appid && appid == "") && (_token)) {
                throw new Error("It is not valid to supply a token without supplying a appId.");
            }
            appId = appid;
            token = _token;
            hasAppId = appId != null;
            hasToken = token != null;
        };

        this.setWil = function (wt, w, wq, rw) {
            if ((!wt ? 1 : 0 ^ !w ? 1 : 0) || (!w ? 1 : 0 ^ !wq ? 1 : 0)) {
                throw new Error("Can't set willTopic, will or willQoS value independently");
            }
            willTopic = wt;
            will = w;
            willQos = wq;
            retainWill = rw;
            hasWill = !!willTopic;
        };

        this.setDup = function (dup) {
            throw new Error(
                "CONNECT messages don't use the DUP flag.");
        };

        this.setRetained = function (retain) {
            throw new Error(
                "CONNECT messages don't use the RETAIN flag.");
        };

        this.setQos = function (qos) {
            throw new Error(
                "CONNECT messages don't use the QoS flags.");
        };

        this.getProtocolId = function () {
            return protocolId;
        };

        this.getProtocolVersion = function () {
            return protocolVersion;
        };

        this.getClientId = function () {
            return clientId;
        };

        this.getKeepAlive = function () {
            return keepAlive;
        };

        this.getappId = function () {
            return appId;
        };

        this.gettoken = function () {
            return token;
        };

        this.isCleanSession = function () {
            return cleanSession;
        };

        this.setWillTopic = function (_willTopic) {
            willTopic = _willTopic;
        };

        this.getWillTopic = function () {
            return willTopic;
        };

        this.getWill = function () {
            return will;
        };

        this.getWillQoS = function () {
            return willQoS;
        };

        this.isWillRetained = function () {
            return retainWill;
        };

        this.hasAppId = function () {
            return hasAppId;
        };

        this.hasToken = function () {
            return hasToken;
        };

        this.hasWill = function () {
            return hasWill;
        };
    }

    ConnectMessage.name = "ConnectMessage";
    ConnectMessage.prototype = new Message();
    ConnectMessage.prototype.constructor = ConnectMessage;
    /**
     * Created by zhangyatao on 2014/10/11.
     */
    function ConnAckMessage() {
        var status, userId, MESSAGE_LENGTH = 2;

        switch (arguments.length) {
            case 0:
                Message.call(this, new type(2));
                break;
            case 1:
                if (arguments[0] instanceof Header) {
                    Message.call(this, arguments[0]);
                } else if (arguments[0] instanceof ConnectionState) {
                    Message.call(this, new type(2));
                    if (arguments[0] == null) {
                        throw new Error("The status of ConnAskMessage can't be null");
                    }
                    status = arguments[0];
                }
        }

        this.messageLength = function () {
            var length = MESSAGE_LENGTH;
            if (userId) {
                length += binaryHelper.toMQttString(userId).length;
            }
            return length;
        };

        this.readMessage = function (In, msglength) {
            var stream = binaryHelper.convertStream(In);
            stream.read();
            var result = stream.read();
            switch (result) {
                case 0:
                    status = new ConnectionState(0);
                    break;
                case 1:
                    status = new ConnectionState(1);
                    break;
                case 2:
                    status = new ConnectionState(2);
                    break;
                case 3:
                    status = new ConnectionState(3);
                    break;
                case 4:
                    status = new ConnectionState(4);
                    break;
                case 5:
                    status = new ConnectionState(5);
                    break;
                case 6:
                    status = new ConnectionState(6);
                    break;
                default :
                    throw new Error("Unsupported CONNACK code: " + result);
            }
            if (msglength > MESSAGE_LENGTH) {//////////
                userId = stream.readUTF();
            }
        };
        this.writeMessage = function (out) {
            var stream = binaryHelper.convertStream(out);
            stream.write(0x80);
            switch (status.getvalue()) {
                case 0:
                    stream.write(0x00);
                    break;
                case 1:
                    stream.write(0x01);
                    break;
                case 2:
                    stream.write(0x02);
                    break;
                case 3:
                    stream.write(0x03);
                    break;
                case 4:
                    stream.write(0x03);
                    break;
                case 5:
                    stream.write(0x04);
                    break;
                case 6:
                    stream.write(0x05);
                    break;
                default :
                    throw new Error("Unsupported CONNACK code: " + status.valueOf());
                    break;
            }
            if (userId) {
                stream.writeUTF(userId);
            }
            return stream;
        };

        this.getStatus = function () {
            return status.valueOf();
        };

        this.setUserId = function (_userId) {
            userId = _userId;
        };

        this.getUserId = function () {
            return userId;
        };

        this.setDup = function (_dup) {
            throw new Error(
                "CONNACK messages don't use the DUP flag.");
        };

        this.setRetained = function (_retain) {
            throw new Error(
                "CONNACK messages don't use the RETAIN flag.");
        };

        this.setQos = function (_qos) {
            throw new Error(
                "CONNACK messages don't use the QoS flags.");
        }
    }

    ConnAckMessage.name = "ConnAckMessage";
    ConnAckMessage.prototype = new Message();
    ConnAckMessage.prototype.constructor = ConnAckMessage;
    /**
     * Created by zhangyatao on 2014/10/14.
     */
    function DisconnectMessage(one) {
        var status;
        this.MESSAGE_LENGTH = 2;
        if (one instanceof Header) {
            Message.call(this, one);
        } else {
            Message.call(this, new type(14));
            if (one instanceof DisconnectionStatus) {
                status = one;
            }
        }
        this.messageLength = function () {
            return this.MESSAGE_LENGTH;
        };
        this.readMessage = function (In, msgLength) {
            var _in = binaryHelper.convertStream(In);
            _in.read();
            var result = _in.read();
            switch (result) {
                case 0:
                    status = new DisconnectionStatus(1);
                    break;
                case 1:
                    status = new DisconnectionStatus(2);
                    break;
                case 2:
                    status = new DisconnectionStatus(3);
                    break;
                default :
                    throw new Error("Unsupported CONNACK code: " + result);
            }
        };
        this.writeMessag = function (Out) {
            var out = binaryHelper.convertStream(Out);
            out.write(0x00);
            switch (status.getValue()) {
                case 1:
                    out.write(0x00);
                    break;
                case 2:
                    out.write(0x01);
                    break;
                case 3:
                    out.write(0x02);
                    break;
                default :
                    throw new Error("Unsupported CONNACK code: " + status);
            }
        };

        this.getStatus = function () {
            return status;
        };

        this.setDup = function (dup) {
            throw new Error("DISCONNECT message does not support the DUP flag");
        };

        this.setQos = function (qos) {
            throw new Error("DISCONNECT message does not support the QoS flag");
        };

        this.setRetained = function (retain) {
            throw new Error("DISCONNECT message does not support the RETAIN flag");
        }
    }

    DisconnectMessage.name = "DisconnectMessage";
    DisconnectMessage.prototype = new Message();
    DisconnectMessage.prototype.constructor = DisconnectMessage;
    /**
     * Created by zhangyatao on 2014/10/14.
     */
    function PingReqMessage(header) {
        if (header && header instanceof Header) {
            Message.call(this, header);
        } else {
            Message.call(this, new type(12));
        }
        this.setDup = function (dup) {
            throw new Error("PINGREQ message does not support the DUP flag");
        };

        this.setQos = function (qos) {
            throw new Error("PINGREQ message does not support the QoS flag");
        };

        this.setRetained = function (retain) {
            throw new Error("PINGREQ message does not support the RETAIN flag");
        };
        this.addEmpty = function (out) {
            var _out = binaryHelper.convertStream(out);
            _out.write(0);
        }
    }

    PingReqMessage.name = "PingReqMessage";
    PingReqMessage.prototype = new Message();
    PingReqMessage.prototype.constructor = PingReqMessage;
    /**
     * Created by zhangyatao on 2014/10/14.
     */
    function PingRespMessage(header) {
        if (header && header instanceof Header) {
            Message.call(this, header);
        } else {
            Message.call(this, new type(13));
        }
    }

    PingRespMessage.name = "PingRespMessage";
    PingRespMessage.prototype = new Message();
    PingRespMessage.prototype.constructor = PingRespMessage;
    /**
     * Created by zhangyatao on 2014/10/13.
     */
    function RetryableMessage(argu) {
        var messageid;
        Message.call(this, argu);
        this.messageLength = function () {
            return 2;
        };
        this.writeMessage = function (Out) {
            var out = binaryHelper.convertStream(Out), id = this.getMessageId(), lsb = id & 0xff, msb = (id & 0xff00) >> 8;
            out.write(msb);
            out.write(lsb);
            return out;
        };
        this.readMessage = function (In, msglength) {
            var _in = binaryHelper.convertStream(In), msgid = _in.read() * 256 + _in.read();
            this.setMessageId(msgid);
        };
        this.setMessageId = function (_messageid) {
            messageid = _messageid;
        };
        this.getMessageId = function () {
            return messageid;
        };
    };
    RetryableMessage.name = "RetryableMessage";
    RetryableMessage.prototype = new Message();
    RetryableMessage.prototype.constructor = RetryableMessage;
    /**
     * Created by zhangyatao on 2014/10/14.
     */
    function PubAckMessage(args) {
        var status, msgLen = 2, date;
        if (args instanceof Header) {
            RetryableMessage.call(this, args);
        } else {
            RetryableMessage.call(this, new type(4));
            this.setMessageId(args);
        }
        this.messageLength = function () {
            return msgLen;
        };
        this.writeMessage = function (Out) {
            var out = binaryHelper.convertStream(Out);
            PubAckMessage.prototype.writeMessage.call(this, out);
        };
        this.readMessage = function (In, msgLength) {
            var _in = binaryHelper.convertStream(In);
            PubAckMessage.prototype.readMessage.call(this, _in);
            date = _in.readInt();
            status = _in.read() * 256 + _in.read();
        };
        this.getStatus = function () {
            return status;
        };
        this.getDate = function () {
            return date;
        };
        this.setDup = function (dup) {
            throw new Error("PubRec messages don't use the DUP flag.");
        };
        this.setRetained = function (retain) {
            throw new Error("PubRec messages don't use the RETAIN flag.");
        };
        this.setQos = function (qos) {
            throw new Error("PubRec messages don't use the QoS flags.");
        };
    }

    PubAckMessage.name = "PubAckMessage";
    PubAckMessage.prototype = new RetryableMessage();
    PubAckMessage.prototype.constructor = PubAckMessage;
    /**
     * Created by zhangyatao on 2014/10/13.
     */
    function PublishMessage(one, two, three) {
        var topic, data, targetId, signature, date;
        if (arguments.length == 1 && one instanceof Header) {
            RetryableMessage.call(this, one);
        } else if (arguments.length == 3) {
            RetryableMessage.call(this, new type(3));
            topic = one;
            targetId = three;
            data = typeof two == "string" ? binaryHelper.toMQttString(two) : two;
            signature = 0x0ff;
        }
        this.messageLength = function () {
            var length = 10;
            length += binaryHelper.toMQttString(topic).length;
            length += binaryHelper.toMQttString(targetId).length;
            length += data.length;
            return length;
        };
        this.writeMessage = function (Out) {
            var out = binaryHelper.convertStream(Out);
            // out.writeLong(signature);
            out.writeUTF(topic);
            out.writeUTF(targetId);
            PublishMessage.prototype.writeMessage.call(this, out);
            out.write(data);
        };
        this.readMessage = function (In, msgLength) {
            var pos = 6;
            var _in = binaryHelper.convertStream(In);
            //signature.readLong();
            date = _in.readInt();
            topic = _in.readUTF();
            // targetId = _in.readUTF();
            pos += binaryHelper.toMQttString(topic).length;
            //pos += binaryHelper.toMQttString(targetId).length;
            PublishMessage.prototype.readMessage.call(this, _in, msgLength);
            data = new Array(msgLength - pos);
            _in.read(data);
        };
        this.getTopic = function () {
            return topic;
        };
        this.getData = function () {
            return data;
        };
        this.getTargetId = function () {
            return targetId;
        };
        this.getDate = function () {
            return date;
        };
    }

    PublishMessage.name = "PublishMessage";
    PublishMessage.prototype = new RetryableMessage();
    PublishMessage.prototype.constructor = PublishMessage;
    /**
     * Created by zhangyatao on 2014/10/14.
     */
    function QueryMessage(one, two, three) {
        var topic, data, targetId, signature;
        if (one instanceof Header) {
            RetryableMessage.call(this, one);
        } else if (arguments.length == 3) {
            RetryableMessage.call(this, new type(5));
            if (typeof two == "string")
                data = binaryHelper.toMQttString(two);
            else
                data = two;
            topic = one;
            targetId = three;
            signature = 0xff;
        }

        this.messageLength = function () {
            var length = 0;
            length += binaryHelper.toMQttString(topic).length;
            length += binaryHelper.toMQttString(targetId).length;
            length += 2;
            length += data.length;
            return length;
        };

        this.writeMessage = function (Out) {
            var out = binaryHelper.convertStream(Out);
            //out.writeLong(signature);
            out.writeUTF(topic);
            out.writeUTF(targetId);
            QueryMessage.prototype.writeMessage.call(this, out);
            out.write(data);
        };

        this.readMessage = function (In, msgLength) {
            var pos = 0, _in = binaryHelper.convertStream(In);
            //signature=_in.readLong();
            topic = _in.readUTF();
            targetId = _in.readUTF();
            // pos+=8;
            pos += binaryHelper.toMQttString(topic).length;
            pos += binaryHelper.toMQttString(targetId).length;
            QueryMessage.prototype.readMessage.call(this, _in, msgLength);
            pos += 2;
            data = new Array(msgLength - pos);
            _in.read(data);
        };

        this.getTopic = function () {
            return topic;
        };
        this.getData = function () {
            return data;
        };
        this.getTargetId = function () {
            return targetId;
        };
        this.getDataAsString = function () {

        };
    }

    QueryMessage.name = "QueryMessage";
    QueryMessage.prototype = new RetryableMessage();
    QueryMessage.prototype.constructor = QueryMessage;
    /**
     * Created by zhangyatao on 2014/10/14.
     */
    function QueryConMessage(messageId) {
        if (messageId instanceof Header) {
            RetryableMessage.call(this, messageId);
        }
        else {
            RetryableMessage.call(this, new type(7));
            this.setMessageId(messageId);
        }
        this.setDup = function (dup) {
            throw new Error("PubRec messages don't use the DUP flag.");
        };

        this.setRetained = function (retain) {
            throw new Error("PubRec messages don't use the RETAIN flag.");
        };

        this.setQos = function (qos) {
            throw new Error("PubRec messages don't use the QoS flags.");
        };

    }

    QueryConMessage.name = "QueryConMessage";
    QueryConMessage.prototype = new RetryableMessage();
    QueryConMessage.prototype.constructor = QueryConMessage;
    /**
     * Created by zhangyatao on 2014/10/14.
     */
    function QueryAckMessage(header) {
        var data, status, date;
        RetryableMessage.call(this, header);
        this.readMessage = function (In, msgLength) {
            var _in = binaryHelper.convertStream(In);
            QueryAckMessage.prototype.readMessage.call(this, _in);
            date = _in.readInt();
            status = _in.read() * 256 + _in.read();
            if (msgLength > 0) {
                data = new Array(msgLength - 8);
                _in.read(data);
            }
        };

        this.getStatus = function () {
            return status;
        };
        this.getDate = function () {
            return date;
        };
        this.getData = function () {
            return data;
        };
        this.setDup = function (_dup) {
            throw new Error("PubAck messages don't use the DUP flag.");
        }
    }

    QueryAckMessage.name = "QueryAckMessage";
    QueryAckMessage.prototype = new RetryableMessage();
    QueryAckMessage.prototype.constructor = QueryAckMessage;
    /**
     * Created by zhangyatao on 2014/10/14.
     */
    function MessageOutputStream(_out) {
        var out = binaryHelper.convertStream(_out);
        this.writeMessag = function (msg) {
            if (msg instanceof Message)
                msg.write(out);
        }
    }

    function MessageInputStream(In) {
        var _in = binaryHelper.convertStream(In);
        this.readMessage = function () {
            var flags = _in.readByte(), header = new Header(flags), msg = null;
            switch (header.getType().currentValue()) {
                case 2:
                    msg = new ConnAckMessage(header);
                    break;
                case 3:
                    msg = new PublishMessage(header);
                    break;
                case 4:
                    msg = new PubAckMessage(header);
                    break;
                case 5:
                    msg = new QueryMessage(header);
                    break;
                case 6:
                    msg = new QueryAckMessage(header);
                    break;
                case 7:
                    msg = new QueryConMessage(header);
                    break;
                case 9:
                case 11:
                case 13:
                    msg = new PingRespMessage(header);
                    break;
                case 1:
                    msg = new ConnectMessage(header);
                    break;
                case 8:
                case 10:
                case 12:
                    msg = new PingReqMessage(header);
                    break;
                case 14:
                    msg = new DisconnectMessage(header);
                    break;
                default :
                    throw new Error("No support for deserializing " + header.getType().currentValue() + " messages");
            }
            msg.read(_in, In.length - 1);
            return msg;
        }
    }

    /**
     * Created by zhangyatao on 2014/10/15.
     */
    var io = {
        connect: function (token, args) {
            if (this.getInstance) {
                return this;
            } else {
                var instance = (new this.createServer()).connect(token, args);
                this.getInstance = function () {
                    return instance;
                };
                return instance;
            }
        }
    };

//if (typeof window != 'undefined') {
//    WEB_SOCKET_SWF_LOCATION = 'WebSocketMain.swf';
//    WEB_SOCKET_DEBUG = true;
//    try {
//        WebSocket.loadFlashPolicyFile("xmlsocket://192.168.1.111:8010");
//    } catch (e) {
//    }
//}
//工具类
    (function () {
        var _pageLoaded = false;
        io.util = {
            ios: false,
            //加载时执行
            load: function (fn) {
                if (document.readystate == 'complete' || _pageLoaded)
                    return fn();
                if ('attachEvent' in window) {
                    window.attachEvent("onload", fn);
                } else {
                    window.addEventListener("load", fn, false);
                }
            },
            //继承
            inherit: function (ctor, superCtor) {
                for (var i in superCtor.prototype) {
                    ctor.prototype[i] = superCtor.prototype[i];
                }
            },
            //查找下标
            indexOf: function (arr, item, from) {
                for (var l = arr.length, i = (from < 0) ? Math.max(0, +from) : from || 0; i < l; i++) {
                    if (arr[i] == item) {
                        return i;
                    }
                }
                return -1;
            },
            //检查是否为数组
            isArray: function (obj) {
                return Object.prototype.toString.call(obj) == '[Object Array]';
            },
            //遍历
            forEach: function (arr, func) {
                if ([].forEach)
                    return [].forEach.call(arr, func);
                else
                    for (var i = 0; i < arr.length; i++)
                        func.call(arr, arr[i], i, arr);
            },
            //合并
            merge: function (target, additional) {
                for (var i in additional) {
                    if (additional.hasOwnProperty(i))
                        target[i] = additional[i];
                }
            },
            //次数
            "methodCache": {},
            "getSequenceByName": function (name) {
                if (!this.methodCache[name])
                    this.methodCache[name] = 1;
                return this.methodCache[name]++;
            },
            JSONStringify: function (x) {
                if (window.JSON) {
                    return JSON.stringify(x);
                } else {
                    var back = "{"
                    for (var i in x) {
                        back += i + ":" + (Object.prototype.toString.call(x[i]) == "[object Object]" ? arguments.callee(x[i]) : x[i] ) + ",";
                    }
                    back = back.slice(0, back.length - 1) + "}";
                    return back;
                }
            },
            JSONParse: function (x) {
                if (window.JSON) {
                    return JSON.parse(x);
                } else {
                    return eval("(" + x + ")");
                }
            },
            arrayFrom: function (typedarray) {
                if (Object.prototype.toString.call(typedarray) == "[object ArrayBuffer]") {
                    var arr = new Int8Array(typedarray);
                    return [].slice.call(arr);
                }
                if (io.util.isArray(typedarray))
                    return typedarray;
                for (var back = [], i = 0; i < typedarray.length; i++) {
                    back.push(typedarray[i]);
                }
                return back;
            },
            filter: function (array, func) {
                if ([].filter) {
                    return array.filter(func);
                } else {
                    var temp = [];
                    for (var i = 0; i < array.length; i++) {
                        func(array[i], i, array) ? temp.push(array[i]) : void 0;
                    }
                    return temp;
                }
            },
            remove: function (array, func) {
                for (var i = 0; i < array.length; i++) {
                    if (func(array[i])) {
                        return array.splice(i, 1)[0];
                    }
                }
                return null;
            },
            getIndex: function (arr, func) {
                for (var i = 0; i < arr.length; i++) {
                    if (func(arr[i])) {
                        return i;
                    }
                }
                return -1;
            },
            int64ToTimestamp: function (obj, isDate) {
                var low = obj.low,
                    max = Math.pow(2, 32);
                if (low < 0) {
                    low += max
                }
                if (isDate)
                    return new Date(obj.high * Math.pow(2, 32) + low);
                return obj.high * Math.pow(2, 32) + low;
            }, cookieHelper: {
                getCookieVal: function (offset) {
                    var endstr = document.cookie.indexOf(";", offset);
                    if (endstr == -1) {
                        endstr = document.cookie.length;
                    }
                    return unescape(document.cookie.substring(offset, endstr));
                },
                getCookie: function (name) {
                    var arg = name + "=";
                    var alen = arg.length;
                    var clen = document.cookie.length;
                    var i = 0;
                    while (i < clen) {
                        var j = i + alen;
                        if (document.cookie.substring(i, j) == arg) {
                            return this.getCookieVal(j);
                        }
                        i = document.cookie.indexOf(" ", i) + 1;
                        if (i == 0) break;
                    }
                    return null;
                },
                setCookie: function (name, value) {
                    document.cookie = (name + "=" + escape(value) + "; path=/");
                },
                deleteCookie: function (name) {
                    if (this.getCookie(name)) {
                        document.cookie = (name + "=; path=/; expires=Thu, 01-Jan-1970 00:00:01 GMT");

                    }
                }
            }
        };

        io.util.ios = /iphone|ipad/i.test(navigator.userAgent);
        io.util.android = /android/i.test(navigator.userAgent);
        io.util.opera = /opera/i.test(navigator.userAgent);

        io.util.load(function () {
            _pageLoaded = true;
        });
        //回调类
        io.Promise = function () {
        };
        io.Promise.prototype.then = function (onResolved, onRejected) {
            if (typeof onResolved == "function")
                this.prototype.resolve = onResolved;
            if (typeof onRejected == "function")
                this.prototype.reject = onRejected;
        };
        io.Promise.prototype.resolve = function (value) {
            console.log(value);
        };
        io.Promise.prototype.reject = function (error) {
            console.error(error);
        };
    })();


//抽象类
    (function () {
        var Transport = io.Transport = function (base, options) {
            this.base = base;
            this.options = {
                timeout: 30000 //基于默认心跳间隔
            };
            io.util.merge(this.options, options);
        };
        Transport.prototype.send = function () {
            throw new Error("未重写send()方法");
        };
        Transport.prototype.connect = function () {
            throw new Error("未重写connect()方法");
        };
        Transport.prototype.disconnect = function () {
            throw new Error("未重写disconnect()方法");
        };
        Transport.prototype._encode = function (message) {
            // return probufHelper.toProBuf(message);
        };
        Transport.prototype._decode = function (data) {
            var back = {
                    c: null
                },
                input;
            if (io.util.isArray(data)) {
                input = new MessageInputStream(data);
                back.c = input.readMessage();
            } else {
                var filereader = new FileReader();
                filereader.readAsArrayBuffer(data);
                filereader.onload = function () {
                    console.log("收到的:", io.util.arrayFrom(new Int8Array(filereader.result)));
                    input = new MessageInputStream(io.util.arrayFrom(new Int8Array(filereader.result)));
                    back.c = input.readMessage();
                }
            }
            return back;
        };
        Transport.prototype._onData = function (data) {
            var msgs = this._decode(data),
                self = this;
            setTimeout(function () {
                self._onMessage(msgs.c);
            }, 100);
        };
        Transport.prototype._onMessage = function (message) {
            this.base._onMessage(message);
        };
        Transport.prototype._onConnect = function () {
            this.connected = true;
            this.connecting = false;
            this.base._onConnect();
            //this._setTimeout();
        };
        Transport.prototype._onDisconnect = function () {
            this.connecting = false;
            this.connected = false;
            this.sessionId = null;
            this.base._onDisconnect();
        };
        Transport.prototype._prepareUrl = function () {
            return (this.base.options.secure ? 'https' : 'http') + '://' + this.base.host + ':' + this.base.options.port + '/' + this.base.options.resource + '/' + this.type + (this.sessionId ? ('/' + this.sessionId) : '/');
        };
    })();

//WebSocket
    (function () {
        var WS = io.Transport.websocket = function () {
            io.Transport.apply(this, arguments);
        };
        io.util.inherit(WS, io.Transport);
        WS.prototype.type = 'websocket';
        WS.prototype.connect = function (url) {
            var self = this;
            this.socket = new WebSocket("ws://" + url);
            this.socket.onopen = function () {
                self._onConnect();
            };
            this.socket.onmessage = function (ev) {
                self._onData(ev.data);
            };
            this.socket.onclose = function () {
                console.log("closed")
                self._onClose();
            };
            this.socket.onerror = function (x) {
                console.log("error", x);
            }
            return this;
        };
        WS.prototype.send = function (data) {
            if (this.socket.readyState == 1) {
                if (Int8Array) {
                    var binary = new Int8Array(data);
                    console.log("发送的", binary);
                    this.socket.send(binary.buffer);
                } else {
                    this.socket.send(data);
                }
            }
            return this;
        };
        WS.prototype.disconnect = function () {
            if (this.socket)
                this.socket.close();
            return this;
        };
        WS.prototype._onClose = function () {
            this._onDisconnect();
            return this;
        };
        WS.check = function () {
            return 'WebSocket' in window && WebSocket.prototype && WebSocket.prototype.send && typeof WebSocket !== "undefined";
        };
        WS.xdomainCheck = function () {
            return true;
        };
    })();

//合并
    (function () {
        var Socket = io.createServer = function (host, options) {
            //联接融云服务器

            //如果已经实例过一次
            if (io.getInstance) {
                return io.getInstance();
            }
            this.host = host || document.domain;
            this.options = {
                token: "",
                secure: false,
                document: document,
                port: document.location.port || 80,
                resource: 'RongIM.imlib',
                transports: ['websocket']
            };
            io.util.merge(this.options, options);
            this.serviceCache = {};
            this.connected = false;
            this.connecting = false;
            this._events = {};
            this.currentURL = "";
            this.transport = this.getTransport();
            if (!this.transport && 'console' in window) {
                console.error('消息传递不可用');
            }
        };


        Socket.prototype.getTransport = function () {
            var transports = this.options.transports;
            for (var i = 0, transport; transport = transports[i]; i++) {
                if (io.Transport[transport] && io.Transport[transport].check() && (!this._isXDomain() || io.Transport[transport].xdomainCheck())) {
                    return new io.Transport[transport](this, {});
                }
            }
            return null;
        };

        Socket.prototype.connect = function (url, cb) {
            if (this.transport && !this.connected && arguments.length == 2) {
                //token ? this.options.token = token : void 0;
                if (url) {
                    this.on("connect", cb || function () {
                    });
                }
                if (this.connecting)
                    this.disconnect();
                this.connecting = true;
                url ? this.currentURL = url : void 0;
                this.transport.connect(this.currentURL);
            }
            return this;
        };

        Socket.prototype.send = function (data) {
            if (!this.transport || !this.connected)
                return this._queue(data);
            this.transport.send(data);
        };
        Socket.prototype.disconnect = function (callback) {
            //		if (callback) {
            //			Socket.prototype.on("disconnnect", callback);
            //		}
            if (callback)
                this.fire("statuschanged", callback);
            this.transport.disconnect();
            return this;
        };
        Socket.prototype.reconnect = function (callback) {
            return this.connect(null, typeof callback == "function" ? {
                onSuccess: callback
            } : {});
        };
        Socket.prototype.fire = function (name, args) {
            if (name in this._events) {
                for (var i = 0, ii = this._events[name].methods.length; i < ii; i++) {
                    var holder = this._events[name].holder;
                    this._events[name].methods[i].call(holder, args);
                }
            }
            return this;
        };
        Socket.prototype.removeEvent = function (name, fn) {
            if (name in this._events) {
                for (var a = 0, l = this._events[name].length; a < l; a++) {
                    if (this._events[name][a] == fn)
                        this._events[name].splice(a, 1);
                }
            }
            return this;
        };
        Socket.prototype._queue = function (message) {
            if (!('_queueStack' in this))
                this._queueStack = [];
            this._queueStack.push(message);
            return this;
        };
        Socket.prototype._doQueue = function () {
            if (!('_queueStack' in this) || !this._queueStack.length)
                return this;
            for (var i = 0; i < this._queueStack.length; i++) {
                this.transport.send(this._queueStack[i]);
            }
            this._queueStack = [];
            return this;
        };
        Socket.prototype._isXDomain = function () {
            return this.host !== document.domain;
        };
        Socket.prototype._onConnect = function () {
            this.connected = true;
            this.connecting = false;
            this.fire('connect');
        };
        Socket.prototype._onMessage = function (data) {
            this.fire('message', data);
        };
        Socket.prototype._onDisconnect = function () {
            var wasConnected = this.connected;
            this.connected = false;
            this.connecting = false;
            this._queueStack = [];
            if (wasConnected) {
                this.fire('disconnect');
            }
        };
        Socket.prototype.on = function (name, func, holder) {
            if (!(typeof func == "function" && name))
                return this;
            if (name in this._events)
                io.util.indexOf(this._events, func) == -1 ? this._events[name].Methods.push(func) : void 0;
            else
                this._events[name] = {
                    holder: holder || this,
                    methods: [func]
                };
            return this;
        };
        Socket.prototype.emit = function (name, data) {
            this.fire(name, data);
        };
        Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;
    })();
    /**
     * Created by zhangyatao on 2014/10/16.
     */
    function MessageCallback(_onerror) {
        var timeoutMillis;
        this.timeout = null;
        this.onError = null;

        if (_onerror && typeof _onerror == "number") {
            timeoutMillis = _onerror;
        } else {
            timeoutMillis = 30000;
            this.onError = _onerror;
        }

        this.resumeTimer = function (c) {
            if (timeoutMillis > 0 && (!this.timeout)) {
                this.timeout = setTimeout((new readTimeoutTask(this, c)).run, timeoutMillis);
            }
        };
        this.pauseTimer = function () {
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
        };

        this.readTimeOut = function (_istimeout) {
            if (_istimeout && this.onError)
                this.onError(RongIMClient.callback.ErrorCode.TIMEOUT);
            else
                this.pauseTimer();
        };

        function readTimeoutTask(main, _c) {
            var c = _c;
            this.run = function () {
                if (c && !c.connected) {
                    main.readTimeOut(true);
                }
                main.readTimeOut(true);
            }

        }
    }

    /**
     * Created by zhangyatao on 2014/10/15.
     */
    function MessageHandler(_client) {
        var client = _client,
            publishMap = {
                length: 0
            },
            queryMap = {
                length: 0
            },
            self = this, mapping = {
                "1": 4,
                "2": 0,
                "3": 3,
                "4": 0,
                "5": 1,
                "6": 5
            }, onreceived = null;
        connectCallback = null;

        this.listener = {};


        function QueryItem() {
            this.queryMessage = null;
            this.queryCallback = null;
        }

        function PublishItem() {
            this.publishMessage = null;
            this.publishCallback = null;
        }

        this.putQueryCallback = function (_querycallback, _querymessageid, pbtype) {
            var item = new QueryItem();
            item.queryCallback = new client.QueryCallback(_querycallback.onSuccess, _querycallback.onError);
            item.queryMessage = pbtype;
            item.queryCallback.resumeTimer();
            if (queryMap["length"] >= 10) {
                var len = queryMap["length"] - 9;
                for (var i in queryMap) {
                    if (len == 0)
                        break;
                    delete queryMap[i] ? len-- : void 0;
                }
                queryMap["length"] = 9;
            }
            queryMap[_querymessageid] = item;
            queryMap["length"]++;
        };
        this.putPublishCallback = function (_publishCallback, _publishmessageid, _msg) {
            var item = new PublishItem();
            item.publishCallback = new client.PublishCallback(_publishCallback.onSuccess, _publishCallback.onError);
            item.publishMessage = _msg;
            item.publishCallback.resumeTimer();
            if (publishMap["length"] >= 10) {
                var len = publishMap["length"] - 9;
                for (var i in publishMap) {
                    if (len == 0)
                        break;
                    delete publishMap[i] ? len-- : void 0;
                }
                publishMap["length"] = 9;
            }
            publishMap[_publishmessageid] = item;
            publishMap["length"]++;
        };

        this.setConnectCallback = function (_connectcallback) {
            if (_connectcallback) {
                connectCallback = new client.ConnectAck(_connectcallback.onSuccess, _connectcallback.onError);
                connectCallback.resumeTimer(client.channel);
            }
        };

        this.setReceiveMessageListener = function (_listener) {
            onreceived = _listener.onReceived;
            this.listener.onReceived = function (msg) {
                var entity, message, content, _index = -1, con;
                if (msg.constructor.name != "PublishMessage")
                    entity = msg;
                else {
                    if (msg.getTopic() == "s_ntf") {
                        client.syncTime(client.appId, client.userId, client, self.listener);
                        return;
                    }
                    if (msg.getTopic() == "s_msg") {
                        entity = Modules.DownStreamMessage.decode(msg.getData());
                        client.syncTimeStorage(client.userId, io.util.int64ToTimestamp(entity.getDataTime()));
                    } else {
                        throw new Error("不支持此topic");
                    }
                }
                content = entity.getContent();
                client.syncTimeStorage(client.userId, io.util.int64ToTimestamp(entity.getDataTime()));
                var de = io.util.JSONParse(binaryHelper.readUTF(io.util.arrayFrom(new Int8Array(content.buffer)).slice(content.offset, content.limit)))
                switch (entity.getClassname()) {
                    case "RC:TxtMsg":
                        message = new RongIMClient.txtMessage();
                        break;
                    case "RC:ImgMsg":
                        message = new RongIMClient.imgMessage();
                        message.setImageUri(de.imageUri);
                        break;
                    case "RC:VcMsg":
                        message = new RongIMClient.voiceMessage();
                        message.setDuration(de.duration);
                        break;
                    default :
                        message = new RongIMMessage();
                        break;
                }
                message.setContent(de.content);
                message.setSenderUserId(entity.getFromUserId());
                message.setConversationType(RongIMClient.ConversationType.setValue(mapping[entity.getType()]));
                message.setTargetId(entity.getType() == 3 ? entity.getGroupId() : entity.getFromUserId());
                message.setMessageDirection(RongIMClient.MessageDirection.RECEIVE);
                message.setObjectName(entity.getClassname());
                message.setDetails(de);
                message.setReceivedTime(io.util.int64ToTimestamp(entity.getDataTime()));
                message.setMessageId(message.getConversationType().getValue() + ":" + Date.now());
                message.setReceivedStatus(new RongIMClient.ReceivedStatus());

                con = io.util.filter(RongIMClient.getInstance().getConversationList(), function (item, i) {
                    if (item.getTargetId() == message.getTargetId()) {
                        _index = i;
                        return true;
                    } else {
                        return false;
                    }
                })[0] || io.util.remove(RongIMClient.getInstance().getOldestConversationTypeList(), function (item) {
                    return item.getTargetId() == message.getTargetId();
                });
                if (!con) {
                    con = new RongIMClient.Conversation();
                    con.setTargetId(message.getTargetId());
                    con.setConversationType(message.getConversationType());
                    con.setConversationTitle("");
                }
                con.setReceivedTime(Date.now());
                con.setReceivedStatus(new RongIMClient.ReceivedStatus());
                con.setSenderUserId(message.getSenderUserId());
                con.setObjectName(message.getObjectName());
                con.setNotificationStatus(RongIMClient.ConversationNotificationStatus.DO_NOT_DISTURB);
                con.setLatestMessageId(message.getMessageId());
                con.setLatestMessage(new RongIMClient.MessageContent(message));

                if (_index != 0) {
                    con.setTop();
                }
                onreceived(message);
            };
        };

        this.handleMessage = function (msg) {
            if (!msg)
                return;
            switch (msg.constructor.name) {
                case "ConnAckMessage":
                    connectCallback.process(msg.getStatus(), msg.getUserId());
                    break;
                case "PublishMessage":
                    if (msg.getQos().currentValue() != 0) {
                        client.channel.writeAndFlush(new PubAckMessage(msg.getMessageId()));
                    }
                    if (onreceived)
                        this.listener.onReceived(msg);
                    break;
                case "PubAckMessage":
                    var item = publishMap[msg.getMessageId()];
                    if (item) {
                        if (item.publishCallback) {
                            item.publishCallback.process(msg.getStatus(), msg.getDate(), item.publishMessage);
                        }
                    }
                    break;
                case "QueryAckMessage":
                    if (msg.getQos().currentValue() != 0) {
                        client.channel.writeAndFlush(new QueryConMessage(msg.getMessageId()));
                    }
                    var temp = queryMap[msg.getMessageId()];
                    if (temp) {
                        if (temp.queryCallback) {
                            temp.queryCallback.process(msg.getStatus(), msg.getData(), msg.getDate(), temp.queryMessage);
                        }
                    }
                    break;
                case "PingRespMessage":
                    client.pauseTimer();
                    break;
                case "DisconnectMessage":
                    client.channel.disconnect(new DisconnectionStatus(msg.getStatus()));
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * Created by zhangyatao on 2014/10/15.
     */
    function Client() {
        var timeoutMillis = 100000, lastReadTimer, task, self = this, _enum, _obj;
        this.timeout_ = null;
        this.appId = "";
        this.sdkVer = "1.0.0";
        this.apiVer = "1.0.0";
        this.channel = null;
        this.messageId = 0;
        this.appToken = "";
        this.group = null;
        this.handler = null;
        this.userId = "";
        this.userInfo = null;
        this.ConversationList = [];
        this.oldestConversation = [];
        this.ReceiveMessageListener = null;

        function timeout(x) {
            try {
                x.channel.disconnect();
            } catch (e) {

            }
            clearTimeout(x.timeout_);
            x.timeout_ = null;
            x.channel.socket.fire("statuschanged", 4);
            x.channel.reconnect();
        }

        function myTask(x) {
            var m = x;
            this.run = function () {
                if (!m.timeout_) {
                    return;
                }
                timeout(m);
            }
        }

        function Channel(main, address, cb) {
            var socketurl = address.host + address.port + "?appId=" + main.appId + "&token=" + encodeURIComponent(main.appToken) + "&sdkVer=" + main.sdkVer + "&apiVer=" + main.apiVer;
            this.socket = io.connect(socketurl, cb);
            this.writeAndFlush = function (val) {
                var stream = new RongIMStream([]);
                var msg = new MessageOutputStream(stream);
                msg.writeMessag(val);
                this.socket.send(stream.getBytesArray(true));
            };
            this.reconnect = function () {
                this.socket = this.socket.reconnect();
            };
            this.disconnect = function (x) {
                var code = 4;
                if (x) {
                    code = x;
                }
                this.socket.disconnect(code);
            };
            this.isWriteable = function () {
                return io.getInstance().connected || io.getInstance().connecting;
            };
            this.setConnectStatusListener = function (_enum, func) {
                if (typeof func == "object" && "onChanged" in func) {
                    this.socket.on("statuschanged", function (code) {
                        if (code instanceof DisconnectionStatus) {
                            func.onChanged(code);
                            return;
                        }
                        func.onChanged(_enum.setValue(code));
                    });
                } else {
                    throw new Error("setConnectStatusListener:参数格式不正确");
                }
            };
            this.socket.on("message", main.handler.handleMessage, main.handler)
            this.socket.on("disconnect", function () {
                this.channel.socket.fire("statuschanged", 6);
            }, main);
        }

        function callbackMapping(entity, tag) {
            switch (tag) {
                case "GetUserInfoOutput":
                    var userinfo = new RongIMClient.UserInfo();
                    userinfo.setUserId(entity.getUserId());
                    userinfo.setUserName(entity.getUserName());
                    userinfo.setPortraitUri(entity.getUserPortrait());
                    return userinfo;
                case "GetQNupTokenOutput":
                    return {deadline: io.util.int64ToTimestamp(entity.getDeadline()), token: entity.getToken()};
                case "GetQNdownloadUrlOutput":
                    return {downloadUrl: entity.getDownloadUrl()};
                default:
                    return {};
            }
        }

        this.removeConversationListCache = function () {
            var val = this.ConversationList.splice(10);
            this.oldestConversation.splice(10 - val.length), _str = "";
            this.oldestConversation = val.concat(this.oldestConversation);
        };

        this.resumeTimer = function () {
            if (!this.timeout_) {
                task = new myTask(this);
                this.timeout_ = setTimeout(task.run, timeoutMillis);
            }
            lastReadTimer = Date.now();
        };

        this.pauseTimer = function () {
            if (this.timeout_) {
                clearTimeout(this.timeout_);
                this.timeout_ = null;
            }
        };

        this.setReceiveMessageListener = function (listener) {
            if ((listener instanceof Client.ReceivePublishMessageListener || typeof listener == "object") && "onReceived" in listener)
                this.ReceiveMessageListener = listener;
        };

        this.connect = function (_token, _callback) {
            this.appToken = _token;
            Client.getServerEndpoint(_token, this.appId);
            var count = 0;
            window.getEndpoint = setInterval(function () {
                count++;
                if (Client.Endpoint.port && Client.Endpoint.host) {
                    clearInterval(window.getEndpoint);
                    delete window.getEndpoint;
                    self.handler = new MessageHandler(self);
                    self.handler.setReceiveMessageListener(self.ReceiveMessageListener);
                    self.channel = new Channel(self, Client.Endpoint, function () {
                        self.handler.setConnectCallback(_callback);
                        self.keeplive();
                    });
                    if (_enum && _obj)
                        self.channel.setConnectStatusListener(_enum, _obj);
                    self.channel.socket.fire("statuschanged", 1);
                }
                if (count >= 10) {
                    clearInterval(window.getEndpoint);
                    throw new Error("token is vaild");
                }
            }, 500);
            return false;
        };

        this.close = function () {
            this.channel.disconnect(4);
        };

        this.setConnectionStatusListener = function (enums, obj) {
            _enum = enums;
            _obj = obj;
        };

        this.keeplive = function () {
            var appid = this.appId,
                self = this;
            var heartbeat = setInterval(function () {
                if (!self.channel.isWriteable()) {
                    //console.log("dis");
                    //clearInterval(heartbeat);
                    // self.channel.reconnect();
                } else {
                    self.resumeTimer();
                    self.channel.writeAndFlush(new PingReqMessage());
                    console.log("keep live pingReqMessage sending appId " + appid);
                }
            }, 180000); //240000
        };

        this.publishMessage = function (_topic, _data, _targetId, _callback, _msg) {
            this.messageId++;
            if (this.messageId > 60000) {
                console.log("publish message is over limited");
                this.channel.reconnect();
            }
            var msg = new PublishMessage(_topic, _data, _targetId);
            msg.setMessageId(this.messageId);
            if (_callback) {
                msg.setQos(new Qos(1));
                this.channel.writeAndFlush(msg);
                this.handler.putPublishCallback(_callback, msg.getMessageId(), _msg)
            } else {
                msg.setQos(new Qos(0));
                this.channel.writeAndFlush(msg);
            }
        };

        this.queryMessage = function (_topic, _data, _targetId, _qos, _callback, pbtype) {
            this.messageId++;
            if (this.messageId > 60000) {
                this.channel.reconnect();
            }
            var msg = new QueryMessage(_topic, _data, _targetId);
            msg.setMessageId(this.messageId);
            msg.setQos(_qos);
            this.handler.putQueryCallback(_callback, msg.getMessageId(), pbtype);
            if (this.channel.isWriteable()) {
                this.channel.writeAndFlush(msg);
            }
        };

        this.PublishCallback = function (cb, _timeout) {
            MessageCallback.call(this, _timeout);
            this.process = function (_staus, _serverTime, _msg) {
                this.readTimeOut();
                if (_staus == 0) {
                    if (_msg) {
                        _msg.setSentStatus(RongIMClient.SentStatus.RECEIVED);
                    }
                    cb();
                } else {
                    _timeout(RongIMClient.callback.ErrorCode.UNKNOW);
                }
            };
            var arg = arguments.callee;
            this.readTimeOut = function () {
                arg.prototype.readTimeOut.call(this);
            };
        };
        this.PublishCallback.prototype = new MessageCallback();
        this.PublishCallback.prototype.constructor = this.PublishCallback;

        this.QueryCallback = function (cb, _timeout) {
            MessageCallback.call(this, _timeout);
            this.process = function (status, data, serverTime, pbtype) {
                this.readTimeOut();
                if (status == 0) {
                    if (pbtype && data) {
                        var entity = Modules[pbtype].decode(data);
                        cb(callbackMapping(entity, pbtype));
                    } else {
                        cb(status, data, serverTime);
                    }
                } else {
                    _timeout(RongIMClient.callback.ErrorCode.UNKNOW);
                }
            };
            var arg = arguments.callee;
            this.readTimeOut = function () {
                arg.prototype.readTimeOut.call(this);
            };
        };
        this.QueryCallback.prototype = new MessageCallback();
        this.QueryCallback.prototype.constructor = this.QueryCallback;

        this.ConnectAck = function (cb, _timeout) {
            MessageCallback.call(this, _timeout);
            this.process = function (status, userId) {
                this.readTimeOut();
                if (status.getValue() == 0) {
                    if (self.userId != userId)
                        RongIMClient.getInstance().getUserInfo(userId, {
                            onSuccess: function (data) {
                                self.userInfo = data;
                            },
                            onError: function () {
                                console.warn("拉取用户资料失败");
                            }
                        });
                    self.userId = userId;
                    self.syncTime(self.appId, self.userId, self, self.handler.listener);
                    cb(userId);
                    io.getInstance().fire("statuschanged", 0);
                    io.getInstance()._doQueue();
                } else {
                    _timeout(RongIMClient.ConnectCallback.ErrorCode.setValue(status.getValue()));
                }
            };
            var arg = arguments.callee;
            this.readTimeOut = function () {
                arg.prototype.readTimeOut.call(this);
            };
        };
        this.ConnectAck.prototype = new MessageCallback();
        this.ConnectAck.prototype.constructor = this.ConnectAck;

        this.syncTimeStorage = function (id, time) {
            if (arguments.length == 1) {
                return io.util.cookieHelper.getCookie("SyncTime") || 0;
            } else {
                io.util.cookieHelper.setCookie("SyncTime", time);
            }
        };

        this.syncTime = function (_appId, _currentUserId, _client, _listener) {
            var time = self.syncTimeStorage(_currentUserId), modules = new Modules.SyncRequestMsg();
            modules.setSyncTime(time);
            modules.setIspolling(false);
            _client.queryMessage("pullMsg", io.util.arrayFrom(modules.toArrayBuffer()), _currentUserId, Qos.valueOf(1), {
                onSuccess: function (status, data, servertime) {
                    if (status == 0) {
                        var collection = Modules.DownStreamMessages.decode(data);
                        self.syncTimeStorage(_currentUserId, io.util.int64ToTimestamp(collection.getSyncTime()));
                        var list = collection.getList();
                        if (_listener) {
                            for (var i = 0; i < list.length; i++) {
                                _listener.onReceived(list[i]);
                            }
                        }
                    }
                },
                onError: function () {

                }
            });
        }
    }

    Client.connect = function (appId, token, callback) {
        var client = new Client();
        client.appId = appId;
        client.connect(token, callback);
        return client;
    };
    Client.getServerEndpoint = function (_token, _appId) {
        var Url = {
                "navUrl-Debug": "http://nav.sunquan.rongcloud.net:9001/navi.js",
                "navUrl-Release": "http://nav.cn.rong.io/navi.js"
            },
            xss = document.createElement("script");
        xss.src = Url["navUrl-Debug"] + "?appId=" + _appId + "&token=" + encodeURIComponent(_token) + "&" + "callBack=getServerEndpoint&t=" + Date.now();
        document.body.appendChild(xss);
    };
    Client.ReceivePublishMessageListener = function (func) {
        this.onMessageReceived = (func || function (msg) {

        });
    };
    Client.Endpoint = {
        host: "",
        port: ""
    };
    window.getServerEndpoint = function (x) {
        Client.Endpoint = {
            host: x["server"],
            port: "/websocket"
        }
    };

    function bridge(_appkey, _token, _callback) {
        var _client = Client.connect(_appkey, _token, _callback), _topic = {
            "0": "invtDiz",
            "1": "crDiz",
            "2": "qnUrl",
            "3": "userInf",
            "4": "dizInf",
            "5": "userInf",
            "6": "joinGrp",
            "7": "quitDiz",
            "8": "exitGrp",
            "9": "evctDiz",
            "10": ["ppMsgP", "pdMsgP", "pgMsgP", "pcMsgP"],
            "11": "pdOpen",
            "12": "rename",
            "13": ["uGcmpr", "pGrps"],
            "14": "qnTkn"
        };
        this.getIO = function () {
            return io;
        };
        this.getCurrentUserInfo = function () {
            return _client.userInfo;
        };
        this.setConnectionStatusListener = function (one, two) {
            if (_client) {
                _client.setConnectionStatusListener(one, two);
                return true;
            }
            return false;
        };
        this.setReceiveMessageListener = function (_listener) {
            if (_client) {
                _client.setReceiveMessageListener(_listener);
            } else {
                throw new Error("NullPointExpection");
            }
        };
        this.removeConversationListCache = function () {
            _client.removeConversationListCache();
        }
        this.getCurrentConversationList = function () {
            return _client.ConversationList;
        };
        this.getCurrentOldestConversationList = function () {
            return _client.oldestConversation;
        };
        this.reConnect = function () {
            _client.channel.reconnect();
        };
        this.disConnect = function () {
            _client.channel.disconnect();
        };
        this.queryMsg = function (topic, content, targetid, callback, pbname) {
            _client.queryMessage(_topic[topic], content, targetid, Qos.valueOf(0), callback, pbname);
        };
        this.pubMsg = function (topic, content, targetid, callback, msg) {
            _client.publishMessage(_topic[10][topic], content, targetid, callback, msg);
        };
    }

    window.RongBridge = bridge;
})(window);