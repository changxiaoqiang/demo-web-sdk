/**
 * Created by yataozhang on 14/11/3.
 */
(function (win) {
    if (win.RongIMClient) {
        win.RongIMClient.voice = new function () {
            this.init = function () {
                if (/IE/.test(navigator.userAgent) && isinit)//ie内核版本不支持此功能
                    return;
                for (var list = ["http://asd.kefu.rongcloud.cn/js/amr/libamr.js", "http://asd.kefu.rongcloud.cn/js/amr/pcmdata.min.js", "http://asd.kefu.rongcloud.cn/js/amr/amr.js"], i = 0; i < list.length; i++) {
                    var script = document.createElement("script");
                    script.src = list[i];
                    document.head.appendChild(script);
                }
                return (isinit = true);
            };
            var isinit = false;
            this.play = function (DataURL, duration) {
                if (isinit) {
                    if (window.handleFileSelect)
                        window.handleFileSelect(DataURL);
                    else
                        throw new Error("尚未初始化完成，请稍后");
                    this.onprogress(0);
                    var self = this, c = 1, timer = setInterval(function () {
                        self.onprogress(c / duration);
                        c++;
                        if (c >= duration) {
                            clearInterval(timer);
                        }
                    }, 1000);
                } else {
                    throw new Error("the voice is not init,please init;WARNING:IE core版本暂不支持该功能");
                }
            };
            this.onprogress = function () {

            };
        };
    } else {
        throw new Error("请先加载RongIMClient.min.js,http://");
    }
})(window)