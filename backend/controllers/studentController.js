const db = require("../db");


// REGISTER
exports.registerStudent = (req, res) => {

    const { name, prn, year, department, division, email } = req.body;

    const sql = `
        INSERT INTO students
        (name, prn, year, department, division, email)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [name, prn, year, department, division, email],
        (err, result) => {

            if (err) {
                return res.status(400).json({
                    message: "PRN already exists or database error"
                });
            }

            res.status(201).json({
                success: true,
                message: "Student Registered Successfully"
            });
        }
    );
};


// LOGIN
exports.loginStudent = (req, res) => {

    const { name, prn } = req.body;

    const sql = `
        SELECT * FROM students
        WHERE name = ? AND prn = ?
    `;

    db.query(sql, [name, prn], (err, result) => {

        if (err) {
            return res.status(500).json({
                message: "Database error"
            });
        }

        if (result.length === 0) {
            return res.status(401).json({
                message: "Invalid Credentials"
            });
        }

        res.json({
            success: true,
            student: result[0]
        });
    });
};


// DASHBOARD
exports.getDashboard = (req, res) => {

    const prn = req.params.prn;

    const studentSql = `
        SELECT * FROM students WHERE prn = ?
    `;

    db.query(studentSql, [prn], (err, studentResult) => {

        if (err || studentResult.length === 0) {
            return res.status(404).json({
                message: "Student not found"
            });
        }

        const attendanceSql = `
            SELECT * FROM attendance
            WHERE prn = ?
            ORDER BY date DESC
        `;

        db.query(attendanceSql, [prn], (err, attendanceResult) => {

            const totalDays = 30;
            const presentDays = attendanceResult.length;

            const percentage =
                    Number(((presentDays / totalDays) * 100).toFixed(2));

            res.json({
                student: studentResult[0],

                attendance: {
                    attendance_percentage: percentage,
                    days_present: presentDays,
                    status:
                        percentage >= 75
                            ? "GOOD"
                            : "SHORT",

                    logs: attendanceResult
                }
            });
        });
    });
};