<?php
header('Content-Type: application/json');

// YOUR Stability API Key
$apiKey = 'sk-AVgF4eGAUhIXNwiCceZ5jZJhJZyAqv6E9sjNUKIUV2cSiOtF';

// Ensure image uploaded
if (!isset($_FILES['uploadedImage']) || $_FILES['uploadedImage']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(["success" => false, "error" => "No image uploaded or upload error."]);
    exit;
}

// Save uploaded file
$uploadDir = 'uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}
$uploadedFile = $uploadDir . basename($_FILES['uploadedImage']['name']);
move_uploaded_file($_FILES['uploadedImage']['tmp_name'], $uploadedFile);

// Gather form data
$prompt = $_POST['customPrompt'] ?? 'A magical fantasy castle at sunset';
$strength = $_POST['strength'] ?? 0.5; // Default to medium strength if not given

// Prepare cURL
$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => "https://api.stability.ai/v2beta/stable-image/generate/core",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $apiKey",
        "Accept: image/*"
    ],
    CURLOPT_POSTFIELDS => [
        "prompt" => $prompt,
        "mode" => "image-to-image",
        "strength" => $strength,
        "output_format" => "png",
        "image" => new CURLFile(realpath($uploadedFile))
    ]
]);

$response = curl_exec($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

// Handle response
if ($curlError) {
    echo json_encode(["success" => false, "error" => "cURL Error: $curlError"]);
    exit;
}

if ($httpCode == 200) {
    $generatedFileName = "uploads/generated_" . uniqid() . ".png";
    file_put_contents($generatedFileName, $response);

    // Detect protocol automatically
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";

    // Get host and path
    $host = $_SERVER['HTTP_HOST'];
    $basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');

    // Full image URL
    $imageURL = "$protocol://$host$basePath/$generatedFileName";

    echo json_encode([
        "success" => true,
        "generatedImage" => $imageURL
    ]);
} else {
    $errorData = json_decode($response, true);
    $errorMsg = $errorData['message'] ?? 'Unknown error';
    echo json_encode(["success" => false, "error" => "HTTP $httpCode: $errorMsg"]);
}
?>