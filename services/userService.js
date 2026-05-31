const db = require("../config/db");

exports.ownerExists = async () => {
  const [rows] = await db.query(
    "SELECT id FROM users WHERE role = 'owner' LIMIT 1"
  );

  return rows.length > 0;
};
