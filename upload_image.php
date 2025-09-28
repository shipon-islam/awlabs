<?php
$targetDir = "uploads/";
if (!file_exists($targetDir)) {
    mkdir($targetDir, 0755, true);
}

$filename = basename($_FILES["image"]["name"]);
$targetFile = $targetDir . time() . "_" . $filename;

if (move_uploaded_file($_FILES["image"]["tmp_name"], $targetFile)) {
    echo json_encode(["success" => true, "path" => $targetFile]);
} else {
    echo json_encode(["success" => false]);
}
?>