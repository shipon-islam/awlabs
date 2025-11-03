<?php
// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Handle prompt input
$input = json_decode(file_get_contents("php://input"), true);
if (!isset($input['prompt']) || empty($input['prompt'])) {
    http_response_code(400);
    echo json_encode(["error" => "Missing prompt."]);
    exit;
}
$rawPrompt = $input["prompt"];
$prompt = trim($rawPrompt);
$dev_mode = false;

if (stripos($rawPrompt, "awlabsdev:") === 0) {
    $dev_mode = true;
    $prompt = trim(substr($rawPrompt, strlen("awlabsdev:")));
}

// Rate limiting unless dev
if (!$dev_mode) {
    $ip = $_SERVER['REMOTE_ADDR'];
    $counterFile = 'ip_counter.json';
    $today = date('Y-m-d');

    // Load or initialize
    if (!file_exists($counterFile)) {
        file_put_contents($counterFile, '{}');
    }

    $dataRaw = file_get_contents($counterFile);
    $data = json_decode($dataRaw, true);
    if (!is_array($data)) {
        $data = [];
    }

    // Initialize IP or reset if it's a new day
    if (!isset($data[$ip]) || $data[$ip]['date'] !== $today) {
        $data[$ip] = ['count' => 0, 'date' => $today];
    }

    // Enforce limit
    if ($data[$ip]['count'] >= 5) {
        http_response_code(429);
        echo json_encode(["error" => "🛑 You reached your 5 image/day limit. Try again tomorrow!"]);
        exit;
    }

    // Increment count
    $data[$ip]['count'] += 1;
    file_put_contents($counterFile, json_encode($data, JSON_PRETTY_PRINT));
}

// Stability AI proper form-data structure
$api_key = "sk-AVgF4eGAUhIXNwiCceZ5jZJhJZyAqv6E9sjNUKIUV2cSiOtF";
$endpoint = "https://api.stability.ai/v2beta/stable-image/generate/core";

$postFields = [
    'prompt' => $prompt,
    'model' => 'stable-image-core',
    'output_format' => 'png',
    'aspect_ratio' => '1:1',
    'mode' => 'text-to-image'
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $api_key",
    "Accept: image/*"
]);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

// Debug output
if ($curl_error) {
    http_response_code(500);
    echo json_encode(["error" => "Curl failed: $curl_error"]);
    exit;
}

if ($httpcode !== 200) {
    http_response_code($httpcode);
    file_put_contents("debug_stability_error.txt", $response);
    echo json_encode(["error" => "Stability AI returned HTTP $httpcode", "details" => $response]);
    exit;
}

// Save image
$folder = "generated_images";
if (!is_dir($folder)) mkdir($folder);
$filename = uniqid("awlabs_ai_") . ".png";
$filepath = "$folder/$filename";
file_put_contents($filepath, $response);

// Return image URL
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
$host = $_SERVER['HTTP_HOST'];
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$imageURL = "$protocol://$host$basePath/$filepath";

// $imageURL = "https://www.awlabs.online/$filepath";
header('Content-Type: application/json');
echo json_encode(["url" => $imageURL]);
?>
