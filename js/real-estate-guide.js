<div id="real-estate-guide-container" style="margin: 40px 0; padding: 25px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9; position: relative; z-index: 100;">
    
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <span id="back-btn" style="cursor: pointer; font-size: 0.9rem; color: #666; display: none; user-select: none;">← Back</span>
        <div id="progress-bar-bg" style="flex-grow: 1; height: 4px; background: #e0e0e0; margin: 0 15px; border-radius: 2px;">
            <div id="progress-bar-fill" style="width: 10%; height: 100%; background: #333; border-radius: 2px; transition: width 0.3s ease;"></div>
        </div>
        <span id="step-counter" style="font-size: 0.8rem; color: #999; user-select: none;">Step 1</span>
    </div>

    <div id="tree-content">
        <h3 id="question-text" style="margin-bottom: 20px; font-weight: 600; color: #333;">Loading your guide...</h3>
        <div id="options-container" style="display: flex; flex-direction: column; gap: 10px;"></div>
    </div>
</div>

<style>
    .tree-option-btn {
        padding: 12px 20px;
        background-color: white;
        color: #333;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        text-align: left;
        transition: all 0.2s;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
    }
    .tree-option-btn:hover {
        background-color: #333;
        color: white;
        border-color: #333;
    }
    .result-text {
        line-height: 1.6;
        color: #555;
        font-size: 1.1rem;
        background: #fff;
        padding: 15px;
        border-left: 4px solid #333;
        border-radius: 4px;
    }
</style>

<script src="js/real-estate-guide.js"></script>
