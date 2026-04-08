const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017/student_performance";
const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const MONGO_URI = process.env.MONGO_URI || (isVercel ? "" : LOCAL_MONGO_URI);

let cachedConnection = null;

async function connectToDatabase() {
    if (!MONGO_URI) {
        throw new Error("MONGO_URI is not configured. Add your MongoDB Atlas connection string in Vercel Environment Variables.");
    }

    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }

    cachedConnection = mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    });

    await cachedConnection;
    return cachedConnection;
}

const studentSchema = new mongoose.Schema({
    student_id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true }
});

const subjectSchema = new mongoose.Schema({
    subject_id: String,
    subject_name: String
});

const marksSchema = new mongoose.Schema({
    student_id: { type: String, required: true, trim: true },
    subject_id: { type: String, required: true, trim: true },
    marks: { type: Number, required: true, min: 0, max: 100 }
});

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema);
const Subject = mongoose.models.Subject || mongoose.model("Subject", subjectSchema);
const Marks = mongoose.models.Marks || mongoose.model("Marks", marksSchema);

void Subject;

function sendError(res, err, fallbackMessage = "Internal server error") {
    const status = err.name === "ValidationError" ? 400 : 500;
    res.status(status).json({
        message: err.message || fallbackMessage
    });
}

app.use(async (req, res, next) => {
    try {
        await connectToDatabase();
        next();
    } catch (err) {
        console.error("Failed to connect to MongoDB:", err.message);
        res.status(500).json({
            message: err.message || "Database connection failed"
        });
    }
});

app.get("/health", async (req, res) => {
    const dbState = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({ status: "ok", database: dbState });
});

app.post("/students", async (req, res) => {
    try {
        const student = new Student(req.body);
        await student.save();
        res.status(201).json(student);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Student ID already exists" });
        }
        return sendError(res, err, "Unable to add student");
    }
});

app.get("/students", async (req, res) => {
    try {
        const data = await Student.find().sort({ student_id: 1 });
        res.json(data);
    } catch (err) {
        sendError(res, err, "Unable to fetch students");
    }
});

app.put("/students/:student_id", async (req, res) => {
    try {
        const student = await Student.findOneAndUpdate(
            { student_id: req.params.student_id },
            req.body,
            { new: true }
        );
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        res.json(student);
    } catch (err) {
        sendError(res, err, "Unable to update student");
    }
});

app.delete("/students/:student_id", async (req, res) => {
    try {
        const deletedStudent = await Student.findOneAndDelete({ student_id: req.params.student_id });
        if (!deletedStudent) {
            return res.status(404).json({ message: "Student not found" });
        }
        await Marks.deleteMany({ student_id: req.params.student_id });
        res.json({ message: "Student and associated marks deleted" });
    } catch (err) {
        sendError(res, err, "Unable to delete student");
    }
});

app.post("/delete-student", async (req, res) => {
    try {
        const studentId = String(req.body.student_id || "").trim();
        if (!studentId) {
            return res.status(400).json({ message: "student_id is required" });
        }

        const deletedStudent = await Student.findOneAndDelete({ student_id: studentId });
        if (!deletedStudent) {
            return res.status(404).json({ message: "Student not found" });
        }

        await Marks.deleteMany({ student_id: studentId });
        res.json({ message: "Student and associated marks deleted" });
    } catch (err) {
        sendError(res, err, "Unable to delete student");
    }
});

app.post("/marks", async (req, res) => {
    try {
        const studentExists = await Student.exists({ student_id: req.body.student_id });
        if (!studentExists) {
            return res.status(400).json({ message: "Student ID does not exist" });
        }

        const marks = new Marks(req.body);
        await marks.save();
        res.status(201).json(marks);
    } catch (err) {
        sendError(res, err, "Unable to add marks");
    }
});

app.get("/marks", async (req, res) => {
    try {
        const data = await Marks.find();
        res.json(data);
    } catch (err) {
        sendError(res, err, "Unable to fetch marks");
    }
});

app.put("/marks/:id", async (req, res) => {
    try {
        const marks = await Marks.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!marks) {
            return res.status(404).json({ message: "Marks record not found" });
        }
        res.json(marks);
    } catch (err) {
        sendError(res, err, "Unable to update marks");
    }
});

app.delete("/marks/:id", async (req, res) => {
    try {
        const deletedMarks = await Marks.findByIdAndDelete(req.params.id);
        if (!deletedMarks) {
            return res.status(404).json({ message: "Marks record not found" });
        }
        res.json({ message: "Marks deleted" });
    } catch (err) {
        sendError(res, err, "Unable to delete marks");
    }
});

app.get("/average", async (req, res) => {
    try {
        const data = await Marks.aggregate([
            {
                $group: {
                    _id: "$student_id",
                    avgMarks: { $avg: "$marks" }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        res.json(data);
    } catch (err) {
        sendError(res, err, "Unable to calculate averages");
    }
});

app.get("/top", async (req, res) => {
    try {
        const data = await Marks.aggregate([
            {
                $group: {
                    _id: "$student_id",
                    avgMarks: { $avg: "$marks" }
                }
            },
            { $sort: { avgMarks: -1, _id: 1 } },
            { $limit: 3 }
        ]);
        res.json(data);
    } catch (err) {
        sendError(res, err, "Unable to fetch top performers");
    }
});

app.get("/above75", async (req, res) => {
    try {
        const data = await Marks.aggregate([
            {
                $group: {
                    _id: "$student_id",
                    avgMarks: { $avg: "$marks" }
                }
            },
            {
                $match: { avgMarks: { $gt: 75 } }
            },
            { $sort: { avgMarks: -1, _id: 1 } }
        ]);
        res.json(data);
    } catch (err) {
        sendError(res, err, "Unable to fetch students above 75%");
    }
});

module.exports = {
    app,
    connectToDatabase
};
