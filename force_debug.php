<?php
header('Content-Type: text/plain');

$apiKey = 'sk-a9RhXFfdorLCvh27HYpwi7Yb2H4yGcaNSf0MDOsPeJCa4lCe';
$apiHost = 'https://api.stability.ai';
$testImagePath = 'uploads/test.jpg'; // Make sure you upload a small test.jpg into /uploads/

if (!file_exists($testImagePath)) {
    die("❌ Test image not found. Please upload 'test.jpg' into /uploads/ folder first.");
}

$prompt = "Transform this into a colorful anime hero cat sitting on a floating island under sunset sky.";

$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => "$apiHost/v2beta/image-to-image",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $apiKey",
        "Accept: application/json"
    ],
    CURLOPT_POSTFIELDS => [
        "init_image" => new CURLFile(realpath($testImagePath)),
        "init_image_mode" => "IMAGE_STRENGTH",
        "image_strength" => 0.35,
        "text_prompts[0][text]" => $prompt,
        "cfg_scale" => 7,
        "samples" => 1,
        "steps" => 30
    ]
]);

$response = curl_exec($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

// Output results
echo "HTTP CODE: $httpCode\n";
echo "cURL Error: $curlError\n\n";
echo "API Raw Response:\n";
echo $response;
?>