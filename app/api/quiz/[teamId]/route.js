import { NextResponse } from "next/server";
import User from "@models/user";
import Team from "@models/team";
import { connectToDatabase } from "@utils/db";
import QuizTitle from "@models/quizTitle";
import Question from "@models/question";
import Quiz from "@models/quiz";

//get all questions
export async function GET(req, { params }) {
  try {
    await connectToDatabase();
    const email = req.headers.get("Authorization");
    const user = await User.findOne({ email: email });
    const teamDetails = await Team.findOne({
      $or: [{ leader: user._id }, { members: user._id }],
    }).populate(["leader", "members"]);
    if (!teamDetails) {
      return NextResponse.json({
        success: false,
        message: "Team not found",
      });
    }
    const { teamId } = params;
    const quiz = await Quiz.findOne({ team: teamId });
    if (!quiz?.quizStarted)
      return NextResponse.json(
        { message: "Quiz not started" },
        { status: 400 }
      );
    if (quiz?.quizEnded) {
      return NextResponse.json(
        { message: "Quiz already ended" },
        { status: 400 }
      );
    }
    // Fetch the questions for the given quiz IDs
    const questions = await Question.aggregate([
      {
        $match: {
          title: { $in: teamDetails?.quizTopics },
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          options: {
            $map: {
              input: "$options",
              as: "option",
              in: {
                text: "$$option.text",
              },
            },
          },
        },
      },
    ]);
    //   .populate("title", "title") // Populate the title field with the title from QuizTitle
    //   .exec();
    return NextResponse.json({
      success: true,
      message: "All Quiz Titles",
      questions,
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

//quiz started
export async function POST(request, { params }) {
  try {
    await connectToDatabase();
    const email = request.headers.get("Authorization");
    const user = await User.findOne({ email: email });
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" });
    }
    const teamDetails = await Team.findOne({
      $or: [{ leader: user._id }, { members: user._id }],
    }).populate(["leader", "members"]);
    if (!teamDetails) {
      return NextResponse.json({
        success: false,
        message: "Team not found",
      });
    }
    if (teamDetails.members.length != 2) {
      return NextResponse.json({
        success: false,
        message: "Team not complete",
      });
    }
    const { teamId } = params;
    if (teamId !== teamDetails._id.toHexString()) {
      return NextResponse.json({
        success: false,
        message: "Invalid Team Access",
      });
    }
    const quizC = await Quiz.findOne({ team: teamId });
    if (quizC?.quizEnded) {
      return NextResponse.json(
        { message: "Quiz already ended" },
        { status: 400 }
      );
    }
    const quiz = new Quiz({ quizStarted: true, team: teamId });
    await quiz.save();

    return NextResponse.json({
      success: true,
      message: "Quiz started",
    });
  } catch (error) {
    console.error("Error ", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    await connectToDatabase();
    const email = request.headers.get("Authorization");
    const user = await User.findOne({ email: email });
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" });
    }
    const teamDetails = await Team.findOne({
      $or: [{ leader: user._id }, { members: user._id }],
    }).populate(["leader", "members"]);
    if (!teamDetails) {
      return NextResponse.json({
        success: false,
        message: "Team not found",
      });
    }
    if (teamDetails.members.length != 2) {
      return NextResponse.json({
        success: false,
        message: "Team not complete",
      });
    }
    const { teamId } = params;
    if (teamId !== teamDetails._id.toHexString()) {
      return NextResponse.json({
        success: false,
        message: "Invalid Team Access",
      });
    }
    const quizC = await Quiz.findOne({ team: teamId });
    if (!quizC?.quizStarted)
      return NextResponse.json(
        { message: "Quiz not started" },
        { status: 400 }
      );
    if (quizC?.quizEnded) {
      return NextResponse.json(
        { message: "Quiz already ended" },
        { status: 400 }
      );
    }
    const { responses } = await request.json();
    const quiz = await Quiz.findOne({ team: teamId });
    quiz.responses = responses;
    quiz.quizEnded = true;

    // Count correct answers
    let correctCount = 0;
    for (const response of quiz.responses) {
      const question = await Question.findById(response.question._id);
      const correctOption = question.options.find((option) => option.isCorrect);
      if (correctOption && correctOption.text === response.answer) {
        correctCount++;
      }
    }
    await quiz.save();

    return NextResponse.json({
      success: true,
      message: "Quiz ended",
    });
  } catch (error) {
    console.error("Error ", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}