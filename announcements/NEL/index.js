<!doctype html>
<html lang="en-GB">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="../../index.css">
    <link rel="stylesheet" href="../../mrt-color.css">
    <title>EWL Announcements</title>
</head>
<body class="smrt-ewl"> <div id="header">
        <span>joofer.j/announcements (EWL)</span>
        <div id="header-right"><a href="/">Back</a></div>
    </div>

    <div id="announcement-grid"></div>

    <div id="infoModal" class="modal">
        <div class="modal-content">
            <span class="close-button">&times;</span>
            <h2 id="modalTitle"></h2>
            <p id="modalMeta"></p>
            <div id="Description" class="tab-content"></div>
            <div id="Transcript" class="tab-content" style="display:none;"></div>
        </div>
    </div>

    <script src="../player.js"></script>
    <script>
        // Initialize with EWL specific data
        initPlayer({
            jsonUrl: 'ewl.json',
            lineClass: 'smrt-ewl'
        });
    </script>
</body>
</html>
