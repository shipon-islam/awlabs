<?php
// feedback.php - updated with one review per IP protection

header('Content-Type: application/json');

$ip = $_SERVER['REMOTE_ADDR'];

// Load submitted IPs
$reviewIps = [];
if (file_exists('review_ips.json')) {
    $reviewIps = json_decode(file_get_contents('review_ips.json'), true);
}

// Load existing feedbacks
$feedbacks = [];
if (file_exists('feedback.json')) {
    $feedbacks = json_decode(file_get_contents('feedback.json'), true);
}

// Handle POST request (new feedback submission)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Check if already submitted
    if (isset($reviewIps[$ip])) {
        http_response_code(429);
        echo json_encode(['error' => 'You have already submitted a review.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!empty($input['feedback'])) {
        $feedbacks[] = [
            'text' => trim($input['feedback']),
            'stars' => (int)($input['stars'] ?? 0)
        ];

      /*--  file_put_contents('feedback.json', json_encode($feedbacks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); --*/
      
      
       // Save IP as submitted
        $reviewIps[$ip] = true;
        file_put_contents('review_ips.json', json_encode($reviewIps, JSON_PRETTY_PRINT));

      
      
      $feedbackFile = 'feedback.json';
    $newFeedback = [
        'text' => strip_tags($input['feedback']),
        'stars' => isset($input['stars']) ? intval($input['stars']) : 0,
    ];
    $existing = json_decode(file_get_contents($feedbackFile), true);
    array_unshift($existing, $newFeedback);
    file_put_contents($feedbackFile, json_encode($existing, JSON_PRETTY_PRINT));

       
        echo json_encode(['success' => true]);
        exit;
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Feedback text is required.']);
        exit;
    }
}

// Handle GET request (fetch feedbacks)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode($feedbacks, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Default fallback
http_response_code(405);
echo json_encode(['error' => 'Method not allowed.']);
exit;
?>
