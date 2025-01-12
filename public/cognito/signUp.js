import express from "express";
import jwt from "jsonwebtoken";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import dotenv from "dotenv"; // Import dotenv

// Load environment variables from .env file
dotenv.config();

const region = "ap-southeast-2"; // Your AWS region

// Create SSM Client
const ssmClient = new SSMClient({ region });

// Cognito client
const client = new CognitoIdentityProviderClient({ region });

// Function to handle user sign-up and log in
async function signUp(username, password, email) {
  console.log("Signing up user...");

  const clientId = process.env.CLIENT_ID; // Fetch Client ID from environment variable

  const signUpCommand = new SignUpCommand({
    ClientId: clientId,
    Username: username,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });

  try {
    const signUpRes = await client.send(signUpCommand);
    console.log("Sign-up successful:", signUpRes);

    // Check if the user should be an admin
    if (email.endsWith("@admin.com") && password === "Admin123!") {
      await addUserToGroup(username, "Admin"); // Add user to Admin group
    } else {
      await addUserToGroup(username, "Users"); // Add user to Users group
    }

    // After successful sign-up, log the user in automatically
    const loginRes = await login(username, password);
    console.log("Login successful:", loginRes);

    return { signUpRes, loginRes };
  } catch (err) {
    console.error("Error during sign-up:", err);
    // Handle common errors
    handleSignUpErrors(err);
    throw err;
  }
}

// Function to add user to a specified group
async function addUserToGroup(username, groupName) {
  const userPoolId = process.env.USER_POOL_ID; // Fetch User Pool ID from environment variable

  const adminAddUserToGroupCommand = new AdminAddUserToGroupCommand({
    UserPoolId: userPoolId,
    Username: username,
    GroupName: groupName,
  });

  try {
    await client.send(adminAddUserToGroupCommand);
    console.log(`User ${username} added to group ${groupName}.`);
  } catch (err) {
    console.error("Error adding user to group:", err);
  }
}

// Function to handle user login
async function login(username, password) {
  console.log("Logging in user...");

  const clientId = process.env.CLIENT_ID; // Fetch Client ID from environment variable

  const initiateAuthCommand = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });

  try {
    const authRes = await client.send(initiateAuthCommand);
    console.log("Login successful:", authRes);
    const accessToken = authRes.AuthenticationResult.AccessToken;
    localStorage.setItem("accessToken", accessToken); // Store the access token
    return authRes;
  } catch (err) {
    console.error("Error during login:", err);
    throw err;
  }
}

// Handle sign-up errors
function handleSignUpErrors(err) {
  switch (err.name) {
    case "UsernameExistsException":
      console.error("The username is already taken. Please choose another.");
      break;
    case "InvalidPasswordException":
      console.error("The password does not meet the security requirements.");
      break;
    case "InvalidParameterException":
      console.error(
        "Invalid parameters. Ensure the email and password are valid."
      );
      break;
    case "CodeDeliveryFailureException":
      console.error(
        "Failed to deliver confirmation code. Check your email service."
      );
      break;
    default:
      console.error(`Sign-up failed: ${err.message}`);
  }
}

// Example usage
const username = "exampleuser";
const password = "SecurePassword123!";
const email = "example@example.com";

// Call the sign-up function
signUp(username, password, email)
  .then(() => console.log("User signed up and logged in successfully!"))
  .catch((err) => console.error("Sign-up or login failed:", err));
