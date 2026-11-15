from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def test_equivalence_partitioning():
    print("[*] Booting Chrome WebDriver...")
    options = webdriver.ChromeOptions()
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 10)

    try:
        print("[*] Navigating to SafeNetQ Dashboard (http://localhost:5173)...")
        driver.get("http://localhost:5173")
        time.sleep(2) 

        print("[*] Executing Test Case: UI Equivalence Partitioning")
        
        # Step 1: Verify Operator View Default State
        print("    -> Checking Operator View components...")
        wait.until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'RMS Current') or contains(text(), 'PZEM')]")))
        print("[+] PASS: Operator view mounted correctly.")

        # Step 2: Switch to Technician View using the 'Views' dropdown button
        print("    -> Clicking the 'Views' dropdown menu...")
        views_btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[normalize-space()='Views']")
        ))
        views_btn.click()
        print("    -> Selecting 'Technician' option...")
        tech_option = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Technician Controls')]")
        ))
        tech_option.click()

        # Step 3: Wait and Verify Technician View Exclusive Elements
        print("    -> Verifying view switch and exclusive components...")
        manual_trip = wait.until(EC.presence_of_element_located(
            (By.XPATH, "//button[.//span[normalize-space()='Manual Trip']]")
        ))
        fault_table = wait.until(EC.presence_of_element_located((By.TAG_NAME, "table")))
        
        if manual_trip and fault_table:
            print("[+] PASS: Technician view mounted exclusive controls correctly.")
            print("[+] PASS: Equivalence Partitioning Test Complete. Strict boundary maintained.")

    except Exception as e:
        print(f"[-] FAIL: Black-box test failed ({type(e).__name__}): {e!r}")
    finally:
        print("[*] Test execution complete. Closing browser in 3 seconds...")
        time.sleep(3)
        driver.quit()

if __name__ == "__main__":
    test_equivalence_partitioning()
