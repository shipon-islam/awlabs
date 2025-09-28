
<?php
/**
 * File: awlabs_v1.9_upload_image_system.php
 * Description: Handles image uploads for AWLABS v1.9 platform.
 * Author: Nahid R. @ AWTOMATIG
 * Version: 1.9
 * Last Updated: April 22, 2025
 */

// Define upload folder
$targetDir = "uploads/";
$targetFile = $targetDir . basename($_FILES["image"]["name"]);
$imageFileType = strtolower(pathinfo($targetFile, PATHINFO_EXTENSION));
$response = ["status" => "error", "message" => "Unknown error occurred."];

// Check if uploaded file is an image
if (isset($_FILES["image"])) {
    $check = getimagesize($_FILES["image"]["tmp_name"]);
    if ($check !== false) {
        // Try to move uploaded file to target directory
        if (move_uploaded_file($_FILES["image"]["tmp_name"], $targetFile)) {
            $response["status"] = "success";
            $response["url"] = $targetFile;
            $response["message"] = "Image uploaded successfully.";
        } else {
            $response["message"] = "Failed to move uploaded file.";
        }
    } else {
        $response["message"] = "File is not a valid image.";
    }
} else {
    $response["message"] = "No file uploaded.";
}

header("Content-Type: application/json");
echo json_encode($response);
?>
