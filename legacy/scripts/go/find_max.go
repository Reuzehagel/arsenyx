package main

import (
	"fmt"
	"net/http"
	"time"
)

const (
	// We know Uriel is 7511, so we start searching from there
	KnownValidID = 7511
	BaseURL      = "https://overframe.gg/items/arsenal/%d/"
	UserAgent    = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
)

func isValid(id int, client *http.Client) bool {
	req, _ := http.NewRequest("HEAD", fmt.Sprintf(BaseURL, id), nil)
	req.Header.Set("User-Agent", UserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	// 200 means the item exists
	return resp.StatusCode == 200
}

func main() {
	client := &http.Client{Timeout: 5 * time.Second}
	fmt.Println("Searching for the current Maximum ID...")

	low := KnownValidID
	high := KnownValidID + 5000 // Initial jump

	// 1. Find the upper bound
	for isValid(high, client) {
		fmt.Printf("ID %d is valid, jumping higher...\n", high)
		low = high
		high += 1000
	}

	// 2. Binary Search between low and high
	fmt.Printf("Max ID is between %d and %d. Narrowing down...\n", low, high)
	maxID := low
	for low <= high {
		mid := (low + high) / 2
		if isValid(mid, client) {
			maxID = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}

	fmt.Printf("\nTarget found! The current MAX_ID is: %d\n", maxID)
}