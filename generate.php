
<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");

$input = json_decode(file_get_contents("php://input"), true);
$prompt = $input["prompt"] ?? "robot in neon city";

// Replace with your actual Stability AI API key
$api_key = "sk-YOUR-REAL-API-KEY-HERE";

// Build multipart form data
$post_fields = [
    "prompt" => $prompt,
    "output_format" => "png"
];

$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => "https://api.stability.ai/v2beta/stable-image/generate/core",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $api_key",
        "Accept: image/png"
    ],
    CURLOPT_POSTFIELDS => $post_fields
]);

$response = curl_exec($curl);
$http_status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curl_error = curl_error($curl);

// Error handling
if ($response === false || $http_status !== 200) {
    header("Content-Type: application/json");
    echo json_encode([
        "error" => "API call failed",
        "http_status" => $http_status,
        "curl_error" => $curl_error,
        "raw_response" => $response
    ]);
    exit;
}

// ✅ Escaped quotes fix here
header("Content-Type: image/png");
header("Content-Disposition: inline; filename=\"image.png\"");
header("Content-Length: " . strlen($response));
echo $response;
exit;
?>
