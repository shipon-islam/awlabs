<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$ip = $_SERVER['REMOTE_ADDR'];
$limit = 20;
$ipFile = 'ip_counter.json';

if (!file_exists($ipFile)) {
    file_put_contents($ipFile, '{}');
}

$data = json_decode(file_get_contents($ipFile), true);
$today = date("Y-m-d");

if (!isset($data[$ip]) || $data[$ip]['date'] !== $today) {
    $data[$ip] = ["count" => 0, "date" => $today];
}

if ($data[$ip]["count"] >= $limit) {
    http_response_code(429);
    echo json_encode(["error" => "You’ve hit today’s 20-chat limit. Come back tomorrow!"]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$prompt = $input["prompt"] ?? '';

if (!$prompt) {
    http_response_code(400);
    echo json_encode(["error" => "No prompt provided"]);
    exit;
}

$apiKey = "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";

$data[$ip]["count"] += 1;
file_put_contents($ipFile, json_encode($data));

$ch = curl_init("https://api.openai.com/v1/chat/completions");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Content-Type: application/json",
  "Authorization: Bearer $apiKey"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  "model" => "gpt-3.5-turbo",
  "messages" => [
    ["role" => "system", "content" => "You are a helpful assistant."],
    ["role" => "user", "content" => $prompt]
  ]
]));

$response = curl_exec($ch);

if(curl_errno($ch)) {
    echo json_encode(["error" => curl_error($ch)]);
} else {
    echo $response;
}

curl_close($ch);
?>