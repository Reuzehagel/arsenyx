package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"
)

const (
	START_ID    = 1
	MAX_PAGE_ID = 7630
	BASE_URL    = "https://overframe.gg/items/arsenal/%d"
	CONCURRENCY = 10 // Increased to 10. If you get blocked, lower this to 2.
)

type Result struct {
	ID   int
	Name string
}

func main() {
	startTime := time.Now()

	outputPath := filepath.FromSlash("src/data/overframe/items.csv")

	ids := make(chan int, MAX_PAGE_ID)
	results := make(chan Result, MAX_PAGE_ID)
	var wg sync.WaitGroup

	for i := 0; i < CONCURRENCY; i++ {
		wg.Add(1)
		go worker(ids, results, &wg)
	}

	go func() {
		for id := START_ID; id <= MAX_PAGE_ID; id++ {
			ids <- id
		}
		close(ids)
	}()

	doneWriting := make(chan bool)
	go func() {
		file, _ := os.Create(outputPath)
		defer file.Close()
		file.WriteString("id,name\n")

		count := 0
		for res := range results {
			if res.Name != "" && res.Name != "nil" && res.Name != "not_found" && res.Name != "error" {
				file.WriteString(fmt.Sprintf("%d,\"%s\"\n", res.ID, res.Name))
			}
			count++
			if count%100 == 0 {
				fmt.Printf("Progress: %d/%d (Time elapsed: %v)\n", count, MAX_PAGE_ID, time.Since(startTime).Round(time.Second))
			}
		}
		doneWriting <- true
	}()

	wg.Wait()
	close(results)
	<-doneWriting

	fmt.Printf("\nFinished! Results saved to %s\n", outputPath)
	fmt.Printf("Total time taken: %v\n", time.Since(startTime))
}

func worker(ids <-chan int, results chan<- Result, wg *sync.WaitGroup) {
	defer wg.Done()

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	scriptRegex := regexp.MustCompile(`<script id="__NEXT_DATA__" type="application/json">(.*?)</script>`)

	for id := range ids {
		url := fmt.Sprintf(BASE_URL, id)
		
		req, _ := http.NewRequest("GET", url, nil)
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

		resp, err := client.Do(req)
		if err != nil {
			results <- Result{ID: id, Name: "error"}
			continue
		}

		if resp.StatusCode != 200 {
			resp.Body.Close()
			results <- Result{ID: id, Name: "not_found"}
			// Optional: add a tiny sleep if we are being rate limited
			if resp.StatusCode == 429 {
				time.Sleep(2 * time.Second)
			}
			continue
		}

		body, _ := ioutil.ReadAll(resp.Body)
		resp.Body.Close()

		matches := scriptRegex.FindSubmatch(body)
		if len(matches) < 2 {
			results <- Result{ID: id, Name: "nil"}
			continue
		}

		var jsonData map[string]interface{}
		if err := json.Unmarshal(matches[1], &jsonData); err != nil {
			results <- Result{ID: id, Name: "error"}
			continue
		}

		name := extractName(jsonData)
		results <- Result{ID: id, Name: name}
	}
}

func extractName(data map[string]interface{}) string {
	defer func() { recover() }() 
	props := data["props"].(map[string]interface{})
	pageProps := props["pageProps"].(map[string]interface{})
	item := pageProps["item"].(map[string]interface{})
	return item["name"].(string)
}