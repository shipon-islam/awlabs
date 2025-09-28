<?php
header("Content-Type: application/json");

// Toggle to enable/disable IP rate limiting
$enableChatLimit = false;

// Optional IP rate limiting logic
if ($enableChatLimit) {
    // Rate limit configuration
    $maxRequestsPerDay = 20;
    $ipFile = 'ip_counter_chat.json';

    $clientIp = $_SERVER['REMOTE_ADDR'];
    $today = date('Y-m-d');

    // Load IP counter data
    $ipData = file_exists($ipFile) ? json_decode(file_get_contents($ipFile), true) : [];

    // Reset count if it's a new day
    if (!isset($ipData[$clientIp]) || $ipData[$clientIp]['date'] !== $today) {
        $ipData[$clientIp] = ['count' => 0, 'date' => $today];
    }

    // Check rate limit
    if ($ipData[$clientIp]['count'] >= $maxRequestsPerDay) {
        echo json_encode(["error" => "Chat limit reached (20 per 24h). Come back tomorrow!"]);
        exit;
    }

    // Increment count
    $ipData[$clientIp]['count']++;
    file_put_contents($ipFile, json_encode($ipData, JSON_PRETTY_PRINT));
}

// Validate input
$input = json_decode(file_get_contents("php://input"), true);
if (!isset($input["prompt"]) || empty($input["prompt"])) {
    echo json_encode(["error" => "No prompt provided"]);
    exit;
}

// Send to OpenAI API
$apiKey = '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'; // Replace with your actual key
$endpoint = 'https://api.openai.com/v1/chat/completions';

$payload = [
    "model" => "gpt-3.5-turbo",
    "messages" => [
        ["role" => "system", "content" => "You are a helpful assistant."],
        ["role" => "user", "content" => $input["prompt"]],
    ],
    "temperature" => 0.7,
    "max_tokens" => 500
];

$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Authorization: Bearer $apiKey"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    echo json_encode(["error" => "OpenAI API Error", "httpCode" => $httpCode]);
} else {
    echo $response;
}
?>
