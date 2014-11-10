/**
 * Created by yataozhang on 14/11/9.
 */
"use strict";
var RongIMDemo = angular.module("RongIMDemo", ["RongIMDemo.ctrl", "RongIMDemo.directive", "RongIMDemo.filter"], function () {
});
var RongIMDemoCtrl = angular.module("RongIMDemo.ctrl", []);

RongIMDemoCtrl.controller("RongC_chaInfo", function ($scope, $http, $rootScope) {
    var currentConversationTargetId = 0, conver, _historyMessagesCache = {};//历史消息列表

    $scope.owner = {id: "", portrait: "static/images/user_img.jpg", name: "张亚涛"};
    var list = location.search.slice(1).split('&');
    if (list.length == 3) {
        list.forEach(function (item) {
            var val = item.split("=");
            $scope.owner[val[0]] = decodeURIComponent(val[1]);
        });
    } else {
        location.href = "login.html";
        return;
    }

    $scope.ConversationList = [];
    $scope.friendsList = [];
    $rootScope.conversationTitle = "";

    $scope.logout = function () {
        $http({method: "get", url: "/logout?t=" + Date.now()}).success(function (data) {
            if (data.code == 200) {
                location.href = "http://webim.rongcloud.net/WebIMDemo/login.html";
            }
        }).error(function () {

        });
    };

    function initConversationList() {
        $scope.ConversationList.forEach(function (item) {
            item.unread = item.getUnreadMessageCount();
            item.lastTime = item.getLatestTime();
        });
    };
    //加载历史记录
    function getHistory(id, name, type) {
        currentConversationTargetId = id;
        $rootScope.conversationTitle = name;
        conver = RongIMClient.getInstance().createConversation(RongIMClient.ConversationType.setValue(type), id, name);
        conver.setUnreadMessageCount(0);
        if (!_historyMessagesCache[type + "_" + currentConversationTargetId])
            _historyMessagesCache[type + "_" + currentConversationTargetId] = [];
        $rootScope.historyMessages = _historyMessagesCache[type + "_" + currentConversationTargetId];
    }

    $scope.ConversationClick = function (type, targetid, name) {
        getHistory(targetid, name, type);
    };
    $scope.RongDefault = function (target, name, type) {
        var id = $(target).closest("li").attr("targetId");
        getHistory(id, name, type);
    };

    RongIMClient.init("e0x9wycfx7flq");
    var token = "";
    $http({method: "get", url: "/token?t=" + Date.now()}).success(function (data) {
        if (data.code == 200) {
            token = data.result;
            RongIMClient.connect(token.token, {
                onSuccess: function (x) {
                    console.log("connected，userid＝" + x);
                },
                onError: function (c) {
                    console.log("失败:" + c.getMessage())
                }
            });
        }
    }).error(function () {
        alert("获取token失败")
    });
    $http({method: "get", url: "/friends?t=" + Date.now()}).success(function (data) {
        if (data.code == 200) {
            $scope.friendsList = data.result;
        }
    }).error(function () {

    });

    RongIMClient.setConnectionStatusListener({
        onChanged: function (status) {
            console.log(status.getValue(), status.getMessage());
            if (status.getValue() == 0) {
                $scope.ConversationList = RongIMClient.getInstance().getConversationList();
                $rootScope.$apply(function () {
                    initConversationList();
                });
            } else if (status.getValue().constructor.name == "DisconnectionStatus") {
                if (status.getValue().getValue() == 2) {
                    alert(status.getValue().getMessage());
                    location.href = "http://webim.rongcloud.net/WebIMDemo/login.html";
                }
            }
        }
    });
    var namelist = {"184": "房总专用", "group001": "融云群一", "group002": "融云群二", "group003": "融云群三", "rongcloud.net.kefu.service112": "客服"}
    //消息监听器
    RongIMClient.getInstance().setOnReceiveMessageListener({
        onReceived: function (data) {
            if (currentConversationTargetId != data.getTargetId()) {
                var person = $scope.friendsList.filter(function (item) {
                    return item.id == data.getTargetId();
                })[0];
                var tempval = RongIMClient.getInstance().getConversation(data.getConversationType(), data.getTargetId());
                if (person) {
                    tempval.setConversationTitle(person.username);
                } else {
                    tempval.setConversationTitle(namelist[data.getTargetId()] || ("陌生人id:" + data.getTargetId()));
                }
                if (tempval) {
                    tempval.setUnreadMessageCount(tempval.getUnreadMessageCount() + 1);
                }
                if (!_historyMessagesCache[data.getConversationType().getValue() + "_" + data.getTargetId()])
                    _historyMessagesCache[data.getConversationType().getValue() + "_" + data.getTargetId()] = [data];
                else
                    _historyMessagesCache[data.getConversationType().getValue() + "_" + data.getTargetId()].push(data);
            } else {
                $rootScope.$apply(function () {
                    $rootScope.historyMessages.push(data);
                })
            }
            $scope.ConversationList = RongIMClient.getInstance().getConversationList();
            $rootScope.$apply(function () {
                initConversationList();
            });
        }
    });
    //加载表情


    $scope.sendMessage = function () {
        if (!conver && !currentConversationTargetId) {
            alert("请选中需要聊天的人");
            return;
        }
        var con = $("#mainContent").html().replace(/<(|\/)(div>|img.+?>)/g, function (x) {
            return x.charAt(1) == "/" ? "\n" : "";
        }).replace(/\<span class="RongIMexpression_[a-z]+?"><\/span>/g, function (x) {
            return RongIMClient.Expression.getTagByEnglishName(x.substring(30, x.length - 9));
        });
        if (con == "") {
            alert("不允许发送空内容");
            return;
        }
        var msg = new RongIMClient.txtMessage();
        msg.setContent(con);
        var content = new RongIMClient.MessageContent(msg);
        RongIMClient.getInstance().sendMessage(conver.getConversationType(), currentConversationTargetId, content, null, {
            onSuccess: function () {
                $rootScope.historyMessages.push(content.getMessage());
                $rootScope.$apply(function () {
                    initConversationList();
                });
                $("#mainContent").html("");
                console.log("send success")
            }, onError: function (x) {
                $(".dialog_box div[messageId=" + content.getMessage().getMessageId() + "]").addClass("status_error");
                console.log(x.getStatus())
            }
        });
    };
});
var RongIMDemoFilter = angular.module("RongIMDemo.filter", []);
RongIMDemoFilter.filter("showTime", function () {
    return function (item) {
        return new Date(parseInt(item)).toString().split(" ")[4];
    }
});
var RongIMDemoDirective = angular.module("RongIMDemo.directive", []);
RongIMDemoDirective.directive("msgType", function () {
    function initEmotion(str) {
        return str.replace(RongIMClient.Expression.ExpressionRegExp, function (x) {
            var img = RongIMClient.Expression.getExpressionByTag(x);
            return '<span class="RongIMexpression_' + img.englishName + '"><img src="' + img.img.src + '" alt="' + img.chineseName + ' "></span>';
        });
    }

    return {
        link: function ($scope, $element, $attr, ngModel) {
            var s = RongIMClient.getInstance().getIO().util.JSONParse($attr.msgType);
            $($element[0]).closest(".xiaoxiti").after('<div class="slice"></div>');

            $($element[0]).html(initEmotion(s.content));
            $element[0].removeAttribute("msg-type");
        }
    }
});

RongIMDemoDirective.directive("loadPortrait", function () {
    return {
        link: function ($scope, $element, $attr) {
            var s = $attr.loadPortrait.split("@"), val = $scope.friendsList.filter(function (item) {
                return item.id == s[0];
            })[0];
            if (!val)
                RongIMClient.getInstance().getUserInfo(s[0], {
                    onSuccess: function (x) {
                        $element[0].setAttribute("src", x.getPortraituri());
                    }, onError: function () {
                        $element[0].setAttribute("src", 'static/images/user.png');
                    }
                });
            else {
                if (s[1] == 1)
                    $element[0].setAttribute("src", $scope.owner.portrait);
                else
                    $element[0].setAttribute("src", val.portrait);
            }
        }
    }
});