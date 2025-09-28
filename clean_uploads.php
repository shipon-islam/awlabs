<?php
$directory = 'uploads/';
$files = glob($directory . '*');

foreach ($files as $file) {
    if (is_file($file)) {
        $fileModified = filemtime($file);
        if (time() - $fileModified >= 86400) { // 86400 seconds = 24 hours
            unlink($file);
        }
    }
}
?>