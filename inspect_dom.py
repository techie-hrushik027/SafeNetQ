from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def inspect_page_elements():
    print("[*] Launching browser to inspect active DOM elements...")
    options = webdriver.ChromeOptions()
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
    driver = webdriver.Chrome(options=options)

    try:
        driver.get("http://localhost:5173")
        time.sleep(3) # Wait for React to mount

        print("\n--- ALL BUTTONS ON PAGE ---")
        buttons = driver.find_elements(By.TAG_NAME, "button")
        for i, btn in enumerate(buttons):
            print(f"[{i}] Tag: button | Text: '{btn.text}' | Classes: '{btn.get_attribute('class')}'")

        print("\n--- ALL SELECT ELEMENTS ON PAGE ---")
        selects = driver.find_elements(By.TAG_NAME, "select")
        for i, sel in enumerate(selects):
            print(f"[{i}] Tag: select | ID/Class: '{sel.get_attribute('id') or sel.get_attribute('class')}'")

        print("\n--- ALL CLICKABLE DIVS/SPANS ---")
        divs = driver.find_elements(By.XPATH, "//div[@role='button' or contains(@class, 'dropdown') or contains(@class, 'select') or contains(@class, 'toggle')]")
        for i, d in enumerate(divs):
            print(f"[{i}] Tag: div | Text: '{d.text[:20]}' | Classes: '{d.get_attribute('class')}'")

        print("\n==============================\n")
    finally:
        driver.quit()

if __name__ == "__main__":
    inspect_page_elements()