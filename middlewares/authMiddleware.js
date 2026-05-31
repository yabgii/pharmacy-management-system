exports.isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
};

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const user = req.session.user;

    if (!user || !roles.includes(user.role)) {
      return res.send("Access Denied");
    }

    next();
  };
};
