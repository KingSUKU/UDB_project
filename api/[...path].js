const { app } = require("../backend/app");

module.exports = (req, res) => {
    const requestUrl = new URL(req.url, "http://localhost");
    const pathname = requestUrl.pathname.replace(/^\/api/, "") || "/";
    req.url = `${pathname}${requestUrl.search}`;
    return app(req, res);
};
